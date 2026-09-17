import { Controller, Get } from '@nestjs/common';

/**
 * The only HTTP route this service exposes. Real traffic arrives over
 * RabbitMQ; this exists so Docker, Kubernetes or a student can check the
 * process is alive.
 */
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      service: 'auth-service',
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
