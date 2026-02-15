import { error as logError } from "./logger";

/**
 * Centralized error handler for consistent error messaging and logging
 * Maps error codes/objects to user-friendly messages
 */
export class ErrorHandler {
  // Status code to user-friendly messages
  static messages = {
    400: "Invalid request. Please check your input and try again.",
    401: "Your session has expired. Please log in again.",
    403: "You don't have permission to perform this action.",
    404: "The requested resource was not found.",
    409: "This time slot was just booked by someone else. Please choose a different time.",
    500: "Server error. Please try again later.",
    502: "Service temporarily unavailable. Please try again later.",
    503: "Service unavailable. Please try again later.",
    network: "Network error. Please check your connection and try again.",
  };

  /**
   * Parse error and return user-friendly message
   */
  static parse(error) {
    if (!error) return "An unknown error occurred.";

    // Already formatted string
    if (typeof error === "string") return error;

    // Error with status property
    if (error.status) {
      const status = parseInt(error.status);
      if (this.messages[status]) {
        return this.messages[status];
      }
      return `Error (${status}): Please try again.`;
    }

    // Error with message property
    if (error.message) {
      // Check for common patterns
      const msg = error.message.toLowerCase();
      if (msg.includes("network")) {
        return "Network error. Please check your connection and try again.";
      }
      if (msg.includes("timeout")) {
        return "Request timed out. Please try again.";
      }
      if (msg.includes("abort")) {
        return "Request was cancelled. Please try again.";
      }
      return error.message;
    }

    // Error with general property (Django REST framework format)
    if (error.general) {
      if (Array.isArray(error.general)) {
        return error.general.join(". ");
      }
      return error.general;
    }

    // Error with detail property
    if (error.detail) {
      return error.detail;
    }

    // Error with non_field_errors (Django)
    if (error.non_field_errors) {
      if (Array.isArray(error.non_field_errors)) {
        return error.non_field_errors.join(". ");
      }
      return String(error.non_field_errors);
    }

    // Fallback
    return "An unexpected error occurred. Please try again.";
  }

  /**
   * Handle API error consistently
   */
  static handle(error, context = "") {
    const message = this.parse(error);

    // Log the error for debugging
    logError(`Error${context ? ` in ${context}` : ""}:`, {
      message: error.message || error,
      status: error.status,
      context,
    });

    return {
      message,
      userFriendly: true,
      status: error.status || "unknown",
    };
  }

  /**
   * Create a standardized error object
   */
  static create(message, status = 500, details = null) {
    const error = new Error(message);
    error.status = status;
    error.details = details;
    error.userFriendly = true;
    return error;
  }

  /**
   * Check if error is recoverable (should allow retry)
   */
  static isRecoverable(error) {
    if (!error) return false;
    const status = parseInt(error.status || 500);
    // Recoverable: 409 (conflict), 429 (rate limit), 5xx (server errors, except 501)
    return status === 409 || status === 429 || (status >= 500 && status !== 501);
  }

  /**
   * Check if error should trigger logout
   */
  static shouldLogout(error) {
    if (!error) return false;
    const status = parseInt(error.status || 200);
    // Logout on: 401 (unauthorized), 403 (forbidden - session may be revoked)
    return status === 401 || status === 403;
  }

  /**
   * Wrap async function with standardized error handling
   */
  static async withErrorHandling(asyncFn, context = "") {
    try {
      return await asyncFn();
    } catch (error) {
      throw this.create(this.parse(error), error.status || 500, { context });
    }
  }
}

export default ErrorHandler;
