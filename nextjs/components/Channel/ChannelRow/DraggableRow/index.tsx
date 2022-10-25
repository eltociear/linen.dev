import React, { createRef } from 'react';

interface Props {
  className?: string;
  overClassName: string;
  draggable: boolean;
  children: React.ReactNode;
  id: string;
  onDrop?({ from, to }: { from: string; to: string }): void;
}

export default function DraggableRow({
  id,
  className,
  overClassName,
  draggable,
  children,
  onDrop,
}: Props) {
  const ref = createRef<HTMLDivElement>();
  if (!draggable || !onDrop) {
    return <div className={className}>{children}</div>;
  }
  function handleDragStart(event: React.DragEvent) {
    event.dataTransfer.setData('text', id);
  }

  function handleDragOver(event: React.DragEvent) {
    event?.preventDefault();
    return false;
  }

  function handleDragEnter(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const node = ref.current as HTMLDivElement;
    node.classList.add(overClassName);
  }

  function handleDragLeave() {
    const node = ref.current as HTMLDivElement;
    node.classList.remove(overClassName);
  }

  function handleDragEnd() {
    const node = ref.current as HTMLDivElement;
    node.classList.remove(overClassName);
  }

  function handleDrop(event: React.DragEvent) {
    const node = ref.current as HTMLDivElement;
    node.classList.remove(overClassName);
    const data = event.dataTransfer.getData('text');
    if (data === id) {
      return event.stopPropagation();
    }
    return onDrop?.({
      from: data,
      to: id,
    });
  }

  return (
    <div
      className={className}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragEnd={handleDragEnd}
      onDrop={handleDrop}
      draggable
      ref={ref}
    >
      {children}
    </div>
  );
}