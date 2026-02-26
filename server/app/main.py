from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models
from .db.database import engine
from .routes import payments as payment_routes
from .routes import users as user_routes

app = FastAPI(title="Payment Gateway API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models.Base.metadata.create_all(bind=engine)

app.include_router(user_routes.router)
app.include_router(payment_routes.router)


@app.get("/")
def root():
    return {"message": "Payment Gateway API"}

@app.get("/health")
def healthcheck():
	return {"status": "ok"}