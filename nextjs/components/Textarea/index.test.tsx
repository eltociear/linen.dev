import React from 'react';
import { render } from '@testing-library/react';
import Textarea from '.';

describe('Textarea', () => {
  it('renders a textarea', () => {
    const { container } = render(<Textarea name="foo" />);
    expect(container.querySelector('textarea')).toBeTruthy();
  });

  it('renders a label', () => {
    const { container } = render(<Textarea label="foo" name="bar" />);
    expect(container).toHaveTextContent('foo');
  });
});
