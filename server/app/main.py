from fastapi import FastAPI,Response,status,HTTPException,Depends
from . import schemas,models
from .db.database import engine,SessionLocal,get_db
from sqlalchemy.orm import Session

app = FastAPI()

models.Base.metadata.create_all(bind=engine)

@app.get("/")
def root():
    return {"message": "hello world"}

@app.get("/sqlalchemy")
def test_posts(db: Session = Depends(get_db)):
    return {"message": "successfully connected to database"}