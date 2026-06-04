@echo off
IF "%1"=="build_docker" GOTO build_docker
IF "%1"=="run_docker" GOTO run_docker
IF "%1"=="test_docker" GOTO test_docker
IF "%1"=="clean_docker" GOTO clean_docker
IF "%1"=="build_docker_prod" GOTO build_docker_prod
IF "%1"=="run_docker_prod" GOTO run_docker_prod
IF "%1"=="test_docker_prod" GOTO test_docker_prod
IF "%1"=="clean_docker_prod" GOTO clean_docker_prod
IF "%1"=="build_production_docs" GOTO build_production_docs
IF "%1"=="build_production_c_only" GOTO build_production_c_only
IF "%1"=="deploy_c_only" GOTO deploy_c_only
IF "%1"=="docs" GOTO docs
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

:build_docker_prod
docker build -f alpine.prod.Dockerfile -t cdd-web-alpine-prod .
docker build -f debian.prod.Dockerfile -t cdd-web-debian-prod .
GOTO :EOF

:run_docker_prod
docker run -d --name cdd-web-debian-prod-cont -p 8083:80 cdd-web-debian-prod
docker run -d --name cdd-web-alpine-prod-cont -p 8084:80 cdd-web-alpine-prod
GOTO :EOF

:test_docker_prod
CALL make.bat build_docker_prod
CALL make.bat run_docker_prod
echo Waiting for production containers to start...
timeout /t 5 /nobreak > NUL

echo Testing Debian production container...
curl -s http://localhost:8083

echo Testing Alpine production container...
curl -s http://localhost:8084

echo Copying production build artifacts out...
docker cp cdd-web-debian-prod-cont:/usr/share/nginx/html ./build-from-debian-prod
docker cp cdd-web-alpine-prod-cont:/usr/share/nginx/html ./build-from-alpine-prod

CALL make.bat clean_docker_prod
GOTO :EOF

:clean_docker_prod
docker stop cdd-web-debian-prod-cont cdd-web-alpine-prod-cont
docker rm cdd-web-debian-prod-cont cdd-web-alpine-prod-cont
docker rmi cdd-web-debian-prod cdd-web-alpine-prod
GOTO :EOF

:build_production_docs
call npm ci
call npm run build:prod
GOTO :EOF

:docs
call npm run doc
if not exist docs mkdir docs
if exist docs\html rmdir /q /s docs\html
mklink /J docs\html "%CD%\documentation"
GOTO :EOF

:build_production_c_only
call npm ci
call npm run build:c-only -- --base-href /cdd-web-ui-c-only/
GOTO :EOF

:deploy_c_only
CALL make.bat build_production_c_only
echo Deploying to offscale.github.io...
set TARGET_DIR=..\offscale.github.io\cdd-web-ui-c-only
if exist "%TARGET_DIR%" rmdir /s /q "%TARGET_DIR%"
mkdir "%TARGET_DIR%"
xcopy /E /I /Y dist\cdd-web-ui\browser "%TARGET_DIR%"
if exist "%TARGET_DIR%\assets\wasm" rmdir /s /q "%TARGET_DIR%\assets\wasm"
GOTO :EOF
