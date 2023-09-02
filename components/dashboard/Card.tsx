import { FC, PropsWithChildren, ReactNode } from 'react';

export const DescriptionLabel: FC<PropsWithChildren> = ({ children }) => {
  return <div className="p-4 text-sm text-neutral-500">{children}</div>;
};

interface CardProps {
  title: string | ReactNode;
  description?: string | ReactNode;
  accessory?: ReactNode;
  children?: ReactNode;
}

export const Card: FC<CardProps> = ({
  title,
  description,
  accessory,
  children,
}) => {
  return (
    <div className="relative flex flex-col gap-2">
      <div className="flex flex-col gap-2">
        <div className="flex flex-row items-center gap-4">
          <h2 className="flex-grow text-base font-bold text-neutral-100">
            {title}
          </h2>
          {accessory && <div className="flex-none">{accessory}</div>}
        </div>
        {description && (
          <h3 className="text-sm text-neutral-500">{description}</h3>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
};
