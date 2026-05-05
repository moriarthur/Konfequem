import { error as logError } from "./logger";

export interface AppError extends Error {
  status?: number;
  details?: unknown;
  userFriendly?: boolean;
  general?: string | string[];
  non_field_errors?: string | string[];
}

export interface ParsedError {
  message: string;
  userFriendly: boolean;
  status: number | string;
}

export class ErrorHandler {
  static messages: Record<number, string> = {
    400: "Invalid request. Please check your input and try again.",
    401: "Your session has expired. Please log in again.",
    403: "You don't have permission to perform this action.",
    404: "The requested resource was not found.",
    409: "This time slot was just booked by someone else. Please choose a different time.",
    500: "Server error. Please try again later.",
    502: "Service temporarily unavailable. Please try again later.",
    503: "Service unavailable. Please try again later.",
  };

  static parse(error: unknown): string {
    if (!error) return "An unknown error occurred.";

    if (typeof error === "string") return error;

    const err = error as Record<string, unknown>;

    if (err.status) {
      const status = Number(err.status);
      if (this.messages[status]) return this.messages[status];
      return `Error (${status}): Please try again.`;
    }

    if (err.message && typeof err.message === "string") {
      const msg = (err.message as string).toLowerCase();
      if (msg.includes("network"))
        return "Network error. Please check your connection and try again.";
      if (msg.includes("timeout")) return "Request timed out. Please try again.";
      if (msg.includes("abort")) return "Request was cancelled. Please try again.";
      return err.message as string;
    }

    if (err.general) {
      return Array.isArray(err.general)
        ? err.general.join(". ")
        : String(err.general);
    }

    if (err.detail) return String(err.detail);

    if (err.non_field_errors) {
      return Array.isArray(err.non_field_errors)
        ? err.non_field_errors.join(". ")
        : String(err.non_field_errors);
    }

    return "An unexpected error occurred. Please try again.";
  }

  static handle(error: unknown, context = ""): ParsedError {
    const message = this.parse(error);
    const err = error as Record<string, unknown>;

    logError(`Error${context ? ` in ${context}` : ""}:`, {
      message: err.message || error,
      status: err.status,
      context,
    });

    return {
      message,
      userFriendly: true,
      status: (err.status as number | string) || "unknown",
    };
  }

  static create(message: string, status = 500, details: unknown = null): AppError {
    const error = new Error(message) as AppError;
    error.status = status;
    error.details = details;
    error.userFriendly = true;
    return error;
  }

  static isRecoverable(error: unknown): boolean {
    if (!error) return false;
    const status = Number((error as Record<string, unknown>).status || 500);
    return status === 409 || status === 429 || (status >= 500 && status !== 501);
  }

  static shouldLogout(error: unknown): boolean {
    if (!error) return false;
    const status = Number((error as Record<string, unknown>).status || 200);
    return status === 401 || status === 403;
  }

  static async withErrorHandling<T>(asyncFn: () => Promise<T>, context = ""): Promise<T> {
    try {
      return await asyncFn();
    } catch (error) {
      throw this.create(this.parse(error), (error as AppError).status || 500, {
        context,
      });
    }
  }
}

export default ErrorHandler;
