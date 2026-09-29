FROM node:22-alpine AS frontend

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY src ./src
COPY static ./static
RUN npm run build

FROM python:3.12-slim

WORKDIR /app
COPY requirements-web.txt app.py ./
RUN pip install --no-cache-dir -r requirements-web.txt
COPY --from=frontend /app/dist ./dist

EXPOSE 7860
CMD ["gunicorn", "-b", "0.0.0.0:7860", "app:app", "--timeout", "120"]
