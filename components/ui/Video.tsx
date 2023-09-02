import cn from 'classnames';
import { FC } from 'react';

interface VideoProps {
  src?: string;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  controls?: boolean;
}

export const Video: FC<VideoProps> = ({
  src,
  className,
  autoPlay,
  loop,
  controls,
}) => {
  return (
    <div
      className={cn(
        className,
        'not-prose overflow-hidden rounded-md border border-neutral-900',
      )}
    >
      <video
        {...(autoPlay
          ? {
              playsInline: true,
              muted: true,
              autoPlay: true,
            }
          : {})}
        loop={loop}
        controls={controls}
        className="w-full"
        preload="auto"
        src={src}
      ></video>
    </div>
  );
};
