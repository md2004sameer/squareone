package com.squareone;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import com.squareone.model.Document;
import com.squareone.repository.DocumentRepository;
import com.squareone.service.DocumentExportService;
import com.squareone.service.WhatsAppShareService;
import com.squareone.export.PdfDocumentExporter;
import com.squareone.export.PlainTextDocumentExporter;
import com.squareone.export.WordDocumentExporter;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
		"spring.datasource.url=jdbc:h2:mem:squareone-test;DB_CLOSE_DELAY=-1"
})
class SquareoneApplicationTests {

	@Autowired
	private DocumentRepository documentRepository;

	@Autowired
	private PlainTextDocumentExporter plainTextDocumentExporter;

	@Autowired
	private DocumentExportService documentExportService;

	@Autowired
	private PdfDocumentExporter pdfDocumentExporter;

	@Autowired
	private WordDocumentExporter wordDocumentExporter;

	@Autowired
	private WhatsAppShareService whatsAppShareService;

	@Test
	void contextLoads() {
	}

	@Test
	void documentsPersistThroughTheRepository() {
		Document document = documentRepository.save(new Document());
		Document savedDocument = documentRepository.findById(document.getId()).orElseThrow();

		assertThat(savedDocument.getTitle()).isEqualTo("Untitled");
	}

	@Test
	void exportsPlainTextWithTitleAndContent() throws Exception {
		Document document = sampleDocument();

		String text = new String(plainTextDocumentExporter.export(document), StandardCharsets.UTF_8);

		assertThat(text).contains("A thoughtful note", "First sentence.", "Second paragraph.");
	}

	@Test
	void exportServiceSelectsTheExporterAndCreatesASafeFilename() throws Exception {
		Document document = sampleDocument();
		document.setTitle("My note / 1");
		documentRepository.save(document);

		DocumentExportService.ExportedDocument exported =
				documentExportService.export(document.getId(), "txt");

		assertThat(exported.filename()).isEqualTo("My note _ 1.txt");
		assertThat(exported.contentType()).isEqualTo("text/plain;charset=UTF-8");
	}

	@Test
	void exportsReadablePdfWithSquareoneFormatting() throws Exception {
		byte[] pdfBytes = pdfDocumentExporter.export(sampleDocument());

		String pdf = new String(pdfBytes, StandardCharsets.ISO_8859_1);
		assertThat(pdf).startsWith("%PDF-1.4");
		assertThat(pdf).contains("A thoughtful note", "First sentence.", "Second paragraph.", "xref", "%%EOF");
	}

	@Test
	void exportsWordDocumentWithTitleAndContent() throws Exception {
		byte[] wordBytes = wordDocumentExporter.export(sampleDocument());

		Map<String, String> entries = new HashMap<>();
		try (ZipInputStream wordFile = new ZipInputStream(new java.io.ByteArrayInputStream(wordBytes))) {
			ZipEntry entry;
			while ((entry = wordFile.getNextEntry()) != null) {
				ByteArrayOutputStream contents = new ByteArrayOutputStream();
				wordFile.transferTo(contents);
				entries.put(entry.getName(), contents.toString(StandardCharsets.UTF_8));
			}
		}
		assertThat(entries).containsKeys("[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml");
		assertThat(entries.get("word/document.xml"))
				.contains("A thoughtful note", "First sentence.", "Second paragraph.");
	}

	@Test
	void createsWhatsAppShareUrlWithEncodedDocumentText() {
		Document document = sampleDocument();
		documentRepository.save(document);

		String shareUrl = whatsAppShareService.createShareUrl(document.getId());

		assertThat(shareUrl)
				.startsWith("https://wa.me/?text=")
				.contains("A+thoughtful+note")
				.contains("First+sentence.")
				.contains("Second+paragraph.");
	}

	private Document sampleDocument() {
		Document document = new Document();
		document.setTitle("A thoughtful note");
		document.setContent("First sentence.\nSecond paragraph.");
		return document;
	}

}
