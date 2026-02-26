from fastapi import FastAPI

from . import models
from .db.database import engine
from .routes import users as user_routes

app = FastAPI()

models.Base.metadata.create_all(bind=engine)

app.include_router(user_routes.router)


@app.get("/")
def root():
    return {"message": "hello world"}

@app.get("/health")
def healthcheck():
	return {"status": "ok"}