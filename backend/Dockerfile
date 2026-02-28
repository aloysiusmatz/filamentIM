# Gunakan image Python yang ringan
FROM python:3.11-slim

# Set working directory di dalam container
WORKDIR /app

# Copy file requirements dulu agar build lebih cepat (caching)
COPY requirements.txt .

# Install semua library
RUN pip install --no-cache-dir -r requirements.txt

# Copy seluruh sisa kode backend ke dalam /app
COPY . .

# Ekspos port default (sebagai dokumentasi Docker)
EXPOSE 5000

# Jalankan Uvicorn menggunakan mode shell agar bisa membaca variabel $PORT dari .env
# Jika di .env tidak ada PORT, dia akan pakai default 5000
CMD uvicorn server:app --host 0.0.0.0 --port ${PORT:-5000}