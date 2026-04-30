#!/bin/bash
# =====================================================================
# Instalador automático del sistema OISGO en Ubuntu 24.04
# Uso: curl -fsSL https://raw.githubusercontent.com/a456f/muni/main/install.sh | bash
# =====================================================================

set -e

echo "============================================"
echo "  OISGO - Instalación automática"
echo "============================================"

# 1. Actualizar sistema
echo "[1/8] Actualizando sistema..."
apt update && apt upgrade -y

# 2. Instalar dependencias del sistema
echo "[2/8] Instalando paquetes base..."
apt install -y curl git build-essential mysql-server ufw

# 3. Instalar Node.js 22 LTS
echo "[3/8] Instalando Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# 4. Instalar PM2 globalmente
echo "[4/8] Instalando PM2..."
npm install -g pm2

# 5. Configurar MySQL
echo "[5/8] Configurando MySQL..."
systemctl start mysql
systemctl enable mysql

mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS sistema_denuncias CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'appuser'@'localhost' IDENTIFIED BY '123456';
GRANT ALL PRIVILEGES ON sistema_denuncias.* TO 'appuser'@'localhost';
FLUSH PRIVILEGES;
EOF

# 6. Clonar repo
echo "[6/8] Clonando repositorio..."
cd /root
if [ -d "muni" ]; then
    cd muni && git pull
else
    git clone https://github.com/a456f/muni.git
    cd muni
fi

# 7. Importar schema completo
echo "[7/8] Importando base de datos..."
if [ -f "backend/sql/full_schema.sql" ]; then
    mysql -u appuser -p123456 sistema_denuncias < backend/sql/full_schema.sql
fi

# 8. Instalar dependencias y compilar
echo "[8/8] Instalando dependencias del proyecto..."
npm install
cd backend && npm install && cd ..
npm run build

# Crear carpeta de uploads
mkdir -p backend/uploads/{revisiones,firmas,denuncias_ciudadano}

# Iniciar con PM2
echo "Iniciando servicios con PM2..."
pm2 delete all 2>/dev/null || true
pm2 start backend/server.js --name sistema-denuncias
pm2 serve dist 3000 --name frontend --spa
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

# Firewall
ufw allow 22/tcp
ufw allow 3000/tcp
ufw allow 3001/tcp
ufw --force enable

# IP pública
IP=$(curl -s ifconfig.me)

echo ""
echo "============================================"
echo "  INSTALACIÓN COMPLETA"
echo "============================================"
echo "  Panel web:  http://$IP:3000"
echo "  API:        http://$IP:3001"
echo ""
echo "  Login admin:"
echo "    usuario:  admin"
echo "    password: admin123"
echo ""
echo "  MySQL user: appuser / 123456"
echo "  DB name:    sistema_denuncias"
echo ""
echo "  Comandos útiles:"
echo "    pm2 logs            # Ver logs"
echo "    pm2 restart all     # Reiniciar"
echo "    pm2 list            # Ver procesos"
echo "============================================"
