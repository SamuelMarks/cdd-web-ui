.PHONY: build_docker run_docker test_docker clean_docker

build_docker:
	docker build -f alpine.Dockerfile -t cdd-web-alpine .
	docker build -f debian.Dockerfile -t cdd-web-debian .

run_docker:
	docker run -d --name cdd-web-debian-cont -p 8081:80 cdd-web-debian
	docker run -d --name cdd-web-alpine-cont -p 8082:80 cdd-web-alpine

test_docker: build_docker run_docker
	@echo "Waiting for containers to start..."
	sleep 5
	@echo "Testing Debian container..."
	curl -s http://localhost:8081 | grep "app-root"
	@echo "Testing Alpine container..."
	curl -s http://localhost:8082 | grep "app-root"
	
	@echo "Copying build artifacts out..."
	docker cp cdd-web-debian-cont:/usr/share/nginx/html ./build-from-debian
	docker cp cdd-web-alpine-cont:/usr/share/nginx/html ./build-from-alpine
	
	@echo "Cleaning up..."
	$(MAKE) clean_docker

clean_docker:
	docker stop cdd-web-debian-cont cdd-web-alpine-cont || true
	docker rm cdd-web-debian-cont cdd-web-alpine-cont || true
	docker rmi cdd-web-debian cdd-web-alpine || true
