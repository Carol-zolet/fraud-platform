FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir --no-deps xgboost==2.1.3
COPY . .
EXPOSE 8000
CMD ["python", "main.py"]
