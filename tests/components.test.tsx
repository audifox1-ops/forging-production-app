import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import KPIStatusCard from '../src/components/KPIStatusCard';
import SubmitStatusBadge from '../src/components/SubmitStatusBadge';
import { ReasonTextList } from '../src/components/ReasonContent';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import React from 'react';

describe('KPIStatusCard', () => {
  it('should render title and value', () => {
    render(<KPIStatusCard title="제품 달성율" value="95.2%" rate={95.2} />);
    expect(screen.getByText('제품 달성율')).toBeDefined();
    expect(screen.getByText('95.2%')).toBeDefined();
  });

  it('should render subtitle when provided', () => {
    render(<KPIStatusCard title="제품" value="100%" rate={100} subtitle="1,000 / 1,000 KG" />);
    expect(screen.getByText('1,000 / 1,000 KG')).toBeDefined();
  });

  it('should apply green class for high rate', () => {
    const { container } = render(<KPIStatusCard title="테스트" value="100%" rate={100} />);
    expect(container.querySelector('.bg-green-50')).toBeTruthy();
  });

  it('should apply red class for low rate', () => {
    const { container } = render(<KPIStatusCard title="테스트" value="50%" rate={50} />);
    expect(container.querySelector('.bg-red-50')).toBeTruthy();
  });
});

describe('SubmitStatusBadge', () => {
  it('should render not_started status', () => {
    render(<SubmitStatusBadge status="not_started" />);
    expect(screen.getByText('미입력')).toBeDefined();
  });

  it('should render submitted status', () => {
    render(<SubmitStatusBadge status="submitted" />);
    expect(screen.getByText('제출완료')).toBeDefined();
  });

  it('should render approved status', () => {
    render(<SubmitStatusBadge status="approved" />);
    expect(screen.getByText('승인')).toBeDefined();
  });
});

describe('ReasonTextList', () => {
  it('should render fallback when no values', () => {
    render(<ReasonTextList />);
    expect(screen.getByText('-')).toBeDefined();
  });

  it('should render custom fallback', () => {
    render(<ReasonTextList fallback="없음" />);
    expect(screen.getByText('없음')).toBeDefined();
  });

  it('should render values joined', () => {
    render(<ReasonTextList values={['원인1', '원인2']} />);
    expect(screen.getByText(/원인1/)).toBeDefined();
    expect(screen.getByText(/원인2/)).toBeDefined();
  });
});

describe('ErrorBoundary', () => {
  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <div>테스트 자식</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('테스트 자식')).toBeDefined();
  });

  it('should render fallback UI when error occurs', () => {
    const ThrowingComponent = () => {
      throw new Error('테스트 에러');
    };

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('오류가 발생했습니다')).toBeDefined();
  });
});
