from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import timedelta
from typing import Optional, List

# Backport for Python < 3.9
try:
    from typing import Annotated
except ImportError:
    from typing_extensions import Annotated

from database import get_db
from models import User
from schemas import Token, UserResponse, UserCreate, UserUpdate
from auth import verify_password, create_access_token, get_password_hash, ACCESS_TOKEN_EXPIRE_MINUTES, SECRET_KEY, ALGORITHM
from jose import JWTError, jwt
from services.audit_service import log_action

router = APIRouter(tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalars().first()
    if user is None:
        raise credentials_exception
    return user

@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalars().first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        # We can't log failed attempts easily without a user_id, 
        # unless we log against a "System" user or try to find user by username.
        # For now, let's skip failed login logging or log by username if found.
        if user:
             await log_action(db, user.id, "LOGIN_FAILED", "Incorrect password")
             await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role, "id": user.id}, expires_delta=access_token_expires
    )
    
    await log_action(db, user.id, "LOGIN", "User logged in successfully")
    await db.commit()
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/users", response_model=UserResponse)
async def create_user(
    user: UserCreate, 
    current_user: User = Depends(get_current_user), # Require auth
    db: AsyncSession = Depends(get_db)
):
    # Only SuperAdmin and Admin can create users
    if current_user.role not in ["SuperAdmin", "Admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to create users")

    result = await db.execute(select(User).where(User.username == user.username))
    db_user = result.scalars().first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = get_password_hash(user.password)
    new_user = User(
        username=user.username,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        hashed_password=hashed_password,
        role=user.role
    )
    db.add(new_user)
    await log_action(db, current_user.id, "CREATE_USER", f"Created user {user.username}")
    await db.commit()
    await db.refresh(new_user)
    return new_user

@router.get("/users/me", response_model=UserResponse)
async def read_users_me(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user

@router.get("/users", response_model=List[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).order_by(User.id.asc()).offset(skip).limit(limit))
    users = result.scalars().all()
    return users

@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Only Admin can update other users, or user can update themselves
    if current_user.role not in ["SuperAdmin", "Admin"] and current_user.id != user_id:
         raise HTTPException(status_code=403, detail="Not authorized to update this user")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Handle username update
    if user_update.username and user_update.username != user.username:
        # Check uniqueness
        result_existing = await db.execute(select(User).where(User.username == user_update.username))
        existing_user = result_existing.scalars().first()
        if existing_user:
             raise HTTPException(status_code=400, detail="Username already taken")
        user.username = user_update.username

    if user_update.email:
        user.email = user_update.email
    if user_update.first_name:
        user.first_name = user_update.first_name
    if user_update.last_name:
        user.last_name = user_update.last_name
    if user_update.password:
        user.hashed_password = get_password_hash(user_update.password)
    
    # Only admin can change role
    if user_update.role:
        if current_user.role in ["SuperAdmin", "Admin"]:
             user.role = user_update.role
        elif current_user.role not in ["SuperAdmin", "Admin"]:
             # If non-admin tries to change role, ignore it or raise error?
             # Let's ignore it silently or raise 403 if they explicitly try? 
             # Usually safer to just ignore if it's self-update, but for clarity let's raise if they try.
             # But Frontend might send it. Let's just check if it's different.
             if user.role != user_update.role:
                 raise HTTPException(status_code=403, detail="Not authorized to change role")
    
    await log_action(db, current_user.id, "UPDATE_USER", f"Updated user {user_id} ({user.username})")
    await db.commit()
    await db.refresh(user)
    return user

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role not in ["SuperAdmin", "Admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete users")
    
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Admin cannot delete SuperAdmin
    if current_user.role == "Admin" and user.role == "SuperAdmin":
        raise HTTPException(status_code=403, detail="Admins cannot delete Super Admins")

    await db.delete(user)
    await log_action(db, current_user.id, "DELETE_USER", f"Deleted user {user.username}")
    await db.commit()
    return None
