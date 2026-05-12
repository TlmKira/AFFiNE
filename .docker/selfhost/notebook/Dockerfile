ARG JUPYTER_IMAGE=quay.io/jupyter/scipy-notebook:latest
FROM ${JUPYTER_IMAGE}

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

USER ${NB_UID}

RUN python -m pip install --no-cache-dir --upgrade pip && \
    python -m pip install --no-cache-dir \
      numpy \
      pandas \
      scipy \
      matplotlib \
      seaborn \
      plotly \
      scikit-learn \
      statsmodels \
      sympy \
      openpyxl \
      pyarrow \
      requests \
      beautifulsoup4 \
      lxml \
      pillow \
      opencv-python-headless \
      scikit-image \
      imageio \
      tqdm \
      rich \
      loguru \
      ipywidgets

WORKDIR /home/jovyan/work
