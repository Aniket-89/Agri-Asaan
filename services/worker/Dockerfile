# Satellite worker (ADR 0026). Pinned base and uv versions; dependencies come
# from the committed lock file; runs as a non-root user; no secrets inside.
FROM python:3.12.13-slim-bookworm AS build
COPY --from=ghcr.io/astral-sh/uv:0.10.12 /uv /bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

FROM python:3.12.13-slim-bookworm
# The rasterio wheel bundles GDAL but links the system expat library.
RUN apt-get update   && apt-get install -y --no-install-recommends libexpat1   && rm -rf /var/lib/apt/lists/*   && useradd --create-home --uid 10001 worker
WORKDIR /app
COPY --from=build /app/.venv /app/.venv
COPY src ./src
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1
USER worker
ENTRYPOINT ["python", "src/main.py"]
