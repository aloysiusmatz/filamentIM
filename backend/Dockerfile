# Gunakan image Python yang ringan
FROM python:3.11-slim

# Set working directory di dalam container
WORKDIR /app

# Copy file requirements dulu agar build lebih cepat (caching)
COPY requirements.txt .

# Install semua library yang sudah kita list tadi
RUN pip install --no-cache-dir -r requirements.txt

# Copy seluruh sisa kode backend ke dalam /app
COPY . .

# Beri tahu Docker bahwa aplikasi ini akan jalan di port 5000
EXPOSE 5000

# Jalankan server.py menggunakan python
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "5000"]