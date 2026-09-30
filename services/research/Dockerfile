FROM python:3.12-slim
WORKDIR /app
COPY services/research services/research
COPY db db
RUN pip install --no-cache-dir -r services/research/requirements.lock && pip install --no-deps ./services/research
RUN useradd --create-home app
USER app
EXPOSE 8000
CMD ["uvicorn", "agents_research.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
