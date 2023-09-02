import cn from 'classnames';
import Image from 'next/image';
import { FC } from 'react';

interface ContentImageProps {
  src: string;
  alt: string;
  title: string;
  className: string;
}

export const ContentImage: FC<ContentImageProps> = ({
  src,
  alt,
  title,
  className,
  ...props
}) => {
  const [width, height] = src
    .split('/')
    .slice(-1)[0]
    .split('-')[0]
    .slice(1)
    .split('x');
  return (
    <Image
      className={cn(className, 'rounded')}
      alt={alt}
      src={src}
      width={parseInt(width)}
      height={parseInt(height)}
      title={title}
      {...props}
    />
  );
};
