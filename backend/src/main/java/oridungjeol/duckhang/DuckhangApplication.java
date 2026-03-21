package oridungjeol.duckhang;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class DuckhangApplication {

    public static void main(String[] args) {
        SpringApplication.run(DuckhangApplication.class, args);
    }

}
