package com.squareone;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import com.squareone.model.Document;
import com.squareone.repository.DocumentRepository;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
		"spring.datasource.url=jdbc:h2:mem:squareone-test;DB_CLOSE_DELAY=-1"
})
class SquareoneApplicationTests {

	@Autowired
	private DocumentRepository documentRepository;

	@Test
	void contextLoads() {
	}

	@Test
	void documentsPersistThroughTheRepository() {
		Document document = documentRepository.save(new Document());

		assertThat(documentRepository.findById(document.getId()))
				.isPresent()
				.get()
				.extracting(Document::getTitle)
				.isEqualTo("Untitled");
	}

}
