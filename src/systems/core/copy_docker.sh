
docker cp ./pointcloud.js arena-services-docker-arena-web-1:/usr/share/nginx/html/src/systems/core
docker cp ./mqtt.js arena-services-docker-arena-web-1:/usr/share/nginx/html/src/systems/core

docker cp ./index.js.doc arena-services-docker-arena-web-1:/usr/share/nginx/html/src/systems/core/index.js

docker cp ./workers/pointcloud-worker.js arena-services-docker-arena-web-1:/usr/share/nginx/html/src/systems/core/workers
