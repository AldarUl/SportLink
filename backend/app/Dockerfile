FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app
ARG JAR=target/sportlink-app-*.jar
COPY ${JAR} app.jar
ENV JAVA_OPTS="-XX:+UseG1GC -XX:MaxRAMPercentage=75"
EXPOSE 8080
ENTRYPOINT ["sh","-c","java $JAVA_OPTS -jar /app/app.jar"]
