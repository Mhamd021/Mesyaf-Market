import { Test, TestingModule } from '@nestjs/testing';
import { VendorGateway } from './vendor.gateway';

describe('VendorGateway', () => {
  let gateway: VendorGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VendorGateway],
    }).compile();

    gateway = module.get<VendorGateway>(VendorGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
