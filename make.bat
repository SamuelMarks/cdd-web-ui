@echo off
IF "%1"=="build_docker" GOTO build_docker
IF "%1"=="run_docker" GOTO run_docker
IF "%1"=="test_docker" GOTO test_docker
IF "%1"=="clean_docker" GOTO clean_docker
GOTO :EOF

:build_docker
docker build -f alpine.Dockerfile -t cdd-web-alpine .
docker build -f debian.Dockerfile -t cdd-web-debian .
GOTO :EOF

:run_docker
docker run -d --name cdd-web-debian-cont -p 8081:80 cdd-web-debian
docker run -d --name cdd-web-alpine-cont -p 8082:80 cdd-web-alpine
GOTO :EOF

:test_docker
CALL make.bat build_docker
CALL make.bat run_docker
echo Waiting for containers to start...
timeout /t 5 /nobreak > NUL

echo Testing Debian container...
curl -s http://localhost:8081

echo Testing Alpine container...
curl -s http://localhost:8082

echo Copying build artifacts out...
docker cp cdd-web-debian-cont:/usr/share/nginx/html ./build-from-debian
docker cp cdd-web-alpine-cont:/usr/share/nginx/html ./build-from-alpine

CALL make.bat clean_docker
GOTO :EOF

:clean_docker
docker stop cdd-web-debian-cont cdd-web-alpine-cont
docker rm cdd-web-debian-cont cdd-web-alpine-cont
docker rmi cdd-web-debian cdd-web-alpine
GOTO :EOF
