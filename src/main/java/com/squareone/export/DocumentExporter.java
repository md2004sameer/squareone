package com.squareone.export;

import java.io.IOException;

import com.squareone.model.Document;

public interface DocumentExporter {

    String format();

    String contentType();

    String fileExtension();

    byte[] export(Document document) throws IOException;
}
