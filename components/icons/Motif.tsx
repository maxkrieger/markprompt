import { FC } from 'react';

interface MotifIconProps {
  className?: string;
}

export const MotifIcon: FC<MotifIconProps> = ({ className }) => {
  return (
    <svg className={className} fill="none" viewBox="0 0 185 185">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M62.467 40.588c-6.107-7.279-17.967-3.54-18.795 5.926l-6.37 72.82c-.988 11.287 7.361 21.238 18.648 22.225l63.777 5.58c11.287.987 21.238-7.362 22.225-18.649l6.371-72.82c.828-9.466-10.201-15.208-17.48-9.1l-17.582 14.753c-2.015 1.691-3.023 2.537-3.464 3.575a4.703 4.703 0 00-.253 2.892c.254 1.098 1.1 2.106 2.791 4.121l3.56 4.244c16.454 19.609.986 49.322-24.514 47.091l-3.367-.294c-25.5-2.231-35.573-34.18-15.964-50.633l4.244-3.56c2.015-1.692 3.023-2.537 3.463-3.575a4.697 4.697 0 00.253-2.892c-.253-1.1-1.099-2.107-2.79-4.122L62.467 40.588zm39.181 6.895c-2.015 1.691-3.023 2.537-4.122 2.79a4.697 4.697 0 01-2.892-.252c-1.038-.441-1.883-1.449-3.574-3.464L76.307 28.975C59.853 9.367 27.905 19.44 25.674 44.94l-6.37 72.82c-1.858 21.226 13.845 39.94 35.072 41.797l63.777 5.58c21.227 1.857 39.94-13.846 41.797-35.072l6.371-72.82c2.231-25.5-27.482-40.968-47.091-24.514l-17.582 14.752zm-3.153 36.041c-1.691-2.015-2.537-3.023-3.575-3.463a4.697 4.697 0 00-2.892-.253c-1.099.253-2.106 1.099-4.121 2.79l-4.244 3.56c-7.279 6.109-3.54 17.968 5.926 18.796l3.367.295c9.466.828 15.208-10.202 9.1-17.481l-3.561-4.244z"
        fill="currentColor"
      />
    </svg>
  );
};
