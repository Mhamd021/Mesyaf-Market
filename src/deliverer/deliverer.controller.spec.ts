import { Test, TestingModule } from '@nestjs/testing';
import { DelivererController } from './deliverer.controller';

describe('DelivererController', () => {
  let controller: DelivererController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DelivererController],
    }).compile();

    controller = module.get<DelivererController>(DelivererController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
