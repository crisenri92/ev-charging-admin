/**
 * Base abstracta para todos los use cases
 * Proporciona estructura común y logging
 */

export abstract class BaseUseCase<TRequest, TResponse> {
  protected abstract readonly name: string;

  protected log(message: string, data?: any): void {
    console.log(`[${this.name}] ${message}`, data || '');
  }

  protected logSuccess(message: string, data?: any): void {
    console.log(`[${this.name}] ✅ ${message}`, data || '');
  }

  protected logError(message: string, error: any): void {
    console.error(`[${this.name}] ❌ ${message}`, error);
  }

  /**
   * Método principal que ejecuta el use case
   */
  abstract execute(request: TRequest): Promise<TResponse>;

  /**
   * Validaciones del request (opcional, override en subclases)
   */
  protected async validate(request: TRequest): Promise<void> {
    // Override en subclases si necesitan validación
  }

  /**
   * Template method que ejecuta el use case con logging y validación
   */
  async run(request: TRequest): Promise<TResponse> {
    try {
      this.log('Starting use case', request);
      
      await this.validate(request);
      
      const response = await this.execute(request);
      
      this.logSuccess('Use case completed', response);
      
      return response;
    } catch (error: any) {
      this.logError('Use case failed', error);
      throw error;
    }
  }
}

/**
 * Error personalizado para use cases
 */
export class UseCaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'UseCaseError';
  }
}
