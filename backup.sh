#!/bin/bash
# Script genérico para crear un backup de una base de datos PostgreSQL en un contenedor Docker.
# Uso obligatorio: -c (nombre del contenedor), -d (nombre de la base de datos) y -u (usuario de PostgreSQL)
# Uso opcional: -b (directorio de backups dentro del contenedor), por defecto: /var/db_backups
#
# Ejemplo:
#   ./backup.sh -c mi_contenedor -d mi_base -u mi_usuario -b /ruta/backup

if [ -f .env ]; then
    set -a           # Exporta automáticamente todas las variables definidas
    source .env
    set +a           # Desactiva la exportación automática
fi


# Primero, se capturan los valores de las variables de entorno (si existen)
CONTAINER_NAME_ENV=${CONTAINER_NAME:-""}
POSTGRES_DB_ENV=${POSTGRES_DB:-""}
POSTGRES_USER_ENV=${POSTGRES_USER:-""}
CONTAINER_BACKUP_DIR_ENV=${CONTAINER_BACKUP_DIR:-"/var/db_backups"}

# Se asignan a las variables que se usarán, permitiendo luego sobrescribir mediante argumentos
CONTAINER_NAME="$CONTAINER_NAME_ENV"
POSTGRES_DB="$POSTGRES_DB_ENV"
POSTGRES_USER="$POSTGRES_USER_ENV"
CONTAINER_BACKUP_DIR="$CONTAINER_BACKUP_DIR_ENV"

# Función para mostrar la ayuda de uso
usage() {
    echo "Uso: $0 -c container_name -d postgres_db -u postgres_user [-b container_backup_dir]"
    echo "  -c  Nombre del contenedor Docker (requerido, o definir en CONTAINER_NAME)"
    echo "  -d  Nombre de la base de datos (requerido, o definir en POSTGRES_DB)"
    echo "  -u  Usuario de PostgreSQL (requerido, o definir en POSTGRES_USER)"
    echo "  -b  Directorio de backups en el contenedor (default: /var/db_backups o CONTAINER_BACKUP_DIR)"
    exit 1
}

# Procesar opciones pasadas como argumentos
while getopts "c:d:u:b:h" opt; do
  case $opt in
    c) CONTAINER_NAME="$OPTARG" ;;
    d) POSTGRES_DB="$OPTARG" ;;
    u) POSTGRES_USER="$OPTARG" ;;
    b) CONTAINER_BACKUP_DIR="$OPTARG" ;;
    h) usage ;;
    *) usage ;;
  esac
done

# Verificar que los parámetros obligatorios hayan sido proporcionados
if [ -z "$CONTAINER_NAME" ] || [ -z "$POSTGRES_DB" ] || [ -z "$POSTGRES_USER" ]; then
  echo "Error: Los parámetros -c, -d y -u son requeridos, ya sea mediante argumentos o en el archivo .env."
  usage
fi

# Generar la fecha y definir el nombre del archivo de backup
DATE=$(date +"%d-%m-%YT%H:%M:%S")
BACKUP_FILE="$CONTAINER_BACKUP_DIR/backup_$DATE.dump"

# Mostrar la configuración utilizada
echo "Iniciando backup con la siguiente configuración:"
echo "  Contenedor:          $CONTAINER_NAME"
echo "  Base de datos:       $POSTGRES_DB"
echo "  Usuario:             $POSTGRES_USER"
echo "  Directorio backup:   $CONTAINER_BACKUP_DIR"
echo "  Archivo de backup:   $BACKUP_FILE"
echo ""

# Ejecutar el backup dentro del contenedor
docker exec -t "$CONTAINER_NAME" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -F c -f "$BACKUP_FILE"

# Comprobar el resultado del comando
if [ $? -eq 0 ]; then
    echo "Backup creado exitosamente: $BACKUP_FILE"
else
    echo "Error al crear el backup."
    exit 1
fi
