package com.squareone.controller;
import com.squareone.service.PersistenceConflictException;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.dao.DataIntegrityViolationException;

@RestControllerAdvice
public class PersistenceExceptionHandler {
    public record ErrorResponse(String message) {}
    @ExceptionHandler({PersistenceConflictException.class, ObjectOptimisticLockingFailureException.class})
    public ResponseEntity<ErrorResponse> conflict(Exception exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(new PersistenceConflictException().getMessage()));
    }
    @ExceptionHandler({IllegalArgumentException.class, MethodArgumentNotValidException.class})
    public ResponseEntity<ErrorResponse> invalid(Exception exception) {
        return ResponseEntity.badRequest().body(new ErrorResponse("Check the submitted values and try again."));
    }
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> invalidRelationship(Exception exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse("This change conflicts with the current workspace. Refresh and try again."));
    }
}
