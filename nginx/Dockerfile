FROM nginx:alpine

# Remove the default site config
RUN rm /etc/nginx/conf.d/default.conf

COPY generate-conf.sh /docker-entrypoint-init.d/generate-conf.sh
RUN chmod +x /docker-entrypoint-init.d/generate-conf.sh

ENTRYPOINT ["/docker-entrypoint-init.d/generate-conf.sh"]
