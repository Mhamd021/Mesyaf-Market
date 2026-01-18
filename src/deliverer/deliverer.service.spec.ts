import { Test, TestingModule } from '@nestjs/testing';
import { DelivererService } from './deliverer.service';

describe('DelivererService', () => {
  let service: DelivererService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DelivererService],
    }).compile();

    service = module.get<DelivererService>(DelivererService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
