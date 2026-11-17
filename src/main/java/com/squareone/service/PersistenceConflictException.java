package com.squareone.service;
public class PersistenceConflictException extends RuntimeException {
    public PersistenceConflictException() { super("This document changed on another device. Keep your draft and resolve the conflict before saving."); }
}
