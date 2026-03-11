import React, { useState, useEffect, useRef, useCallback } from 'react';

interface MenuItemOption {
  label: string;
  action?: string;
  shortcut?: string;
  type?: 'item' | 'separator';
  hasSubmenu?: boolean;
}

interface MenuConfig {
  label: string;
  items: MenuItemOption[];
}

interface MacOSMenuBarProps {
  appName?: string;
  menus?: MenuConfig[];
  onMenuAction?: (action: string) => void;
  className?: string;
}

const DEFAULT_MENUS: MenuConfig[] = [
  {
    label: 'File',
    items: [
      { label: 'New Tab', action: 'new-tab', shortcut: '⌘T' },
      { label: 'New Window', action: 'new-window', shortcut: '⌘N' },
      { label: 'New Private Window', action: 'new-private', shortcut: '⇧⌘N' },
      { type: 'separator' },
      { label: 'Open File...', action: 'open-file', shortcut: '⌘O' },
      { label: 'Open Location...', action: 'open-location', shortcut: '⌘L' },
      { type: 'separator' },
      { label: 'Close Window', action: 'close-window', shortcut: '⇧⌘W' },
      { label: 'Close Tab', action: 'close-tab', shortcut: '⌘W' },
      { label: 'Save Page As...', action: 'save-page', shortcut: '⌘S' },
      { type: 'separator' },
      { label: 'Share', action: 'share', hasSubmenu: true },
      { type: 'separator' },
      { label: 'Print...', action: 'print', shortcut: '⌘P' },
    ],
  },
  {
    label: 'Edit',
    items: [
      { label: 'Undo', action: 'undo', shortcut: '⌘Z' },
      { label: 'Redo', action: 'redo', shortcut: '⇧⌘Z' },
      { type: 'separator' },
      { label: 'Cut', action: 'cut', shortcut: '⌘X' },
      { label: 'Copy', action: 'copy', shortcut: '⌘C' },
      { label: 'Paste', action: 'paste', shortcut: '⌘V' },
      { label: 'Select All', action: 'select-all', shortcut: '⌘A' },
      { type: 'separator' },
      { label: 'Find', action: 'find', shortcut: '⌘F' },
      { label: 'Find Next', action: 'find-next', shortcut: '⌘G' },
      { label: 'Find Previous', action: 'find-prev', shortcut: '⇧⌘G' },
    ],
  },
  {
    label: 'View',
    items: [
      { label: 'as Icons', action: 'view-icons', shortcut: '⌘1' },
      { label: 'as List', action: 'view-list', shortcut: '⌘2' },
      { label: 'as Columns', action: 'view-columns', shortcut: '⌘3' },
      { type: 'separator' },
      { label: 'Enter Full Screen', action: 'fullscreen', shortcut: '⌃⌘F' },
    ],
  },
  {
    label: 'Window',
    items: [
      { label: 'Minimize', action: 'minimize', shortcut: '⌘M' },
      { label: 'Zoom', action: 'zoom' },
      { type: 'separator' },
      { label: 'Bring All to Front', action: 'bring-to-front' },
    ],
  },
  {
    label: 'Help',
    items: [
      { label: 'Search', action: 'search-help' },
      { type: 'separator' },
      { label: 'App Help', action: 'app-help' },
      { label: 'Keyboard Shortcuts', action: 'shortcuts' },
      { type: 'separator' },
      { label: 'Contact Support', action: 'contact-support' },
    ],
  },
];

const APPLE_MENU_ITEMS: MenuItemOption[] = [
  { label: 'About This Mac', action: 'about' },
  { type: 'separator' },
  { label: 'System Preferences...', action: 'preferences' },
  { label: 'App Store...', action: 'app-store' },
  { type: 'separator' },
  { label: 'Recent Items', action: 'recent', hasSubmenu: true },
  { type: 'separator' },
  { label: 'Force Quit Applications...', action: 'force-quit', shortcut: '⌥⌘⎋' },
  { type: 'separator' },
  { label: 'Sleep', action: 'sleep' },
  { label: 'Restart...', action: 'restart' },
  { label: 'Shut Down...', action: 'shutdown' },
  { type: 'separator' },
  { label: 'Lock Screen', action: 'lock', shortcut: '⌃⌘Q' },
  { label: 'Log Out...', action: 'logout', shortcut: '⇧⌘Q' },
];

interface MenuDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  items: MenuItemOption[];
  position: { x: number; y: number };
  onAction?: (action: string) => void;
}

const MenuDropdown: React.FC<MenuDropdownProps> = ({
  isOpen,
  onClose,
  items,
  position,
  onAction
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute backdrop-blur-md z-[60]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        background: 'rgba(40, 40, 40, 0.75)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        borderRadius: '8px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
        minWidth: '220px',
      }}
    >
      <div className="py-1">
        {items.map((item, index) => {
          if (item.type === 'separator') {
            return <div key={index} className="h-px bg-white/15 mx-2 my-1" />;
          }

          return (
            <div
              key={index}
              className="px-4 py-1 text-white text-sm cursor-pointer hover:bg-white/10 transition-colors duration-100 flex justify-between items-center"
              onClick={() => {
                if (item.action) onAction?.(item.action);
                onClose();
              }}
            >
              <span className="flex items-center">
                {item.label}
                {item.hasSubmenu && <span className="ml-2 text-xs opacity-70">▶</span>}
              </span>
              {item.shortcut && <span className="text-xs text-white/60 ml-4">{item.shortcut}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MacOSMenuBar: React.FC<MacOSMenuBarProps> = ({
  appName = 'Finder',
  menus = DEFAULT_MENUS,
  onMenuAction,
  className = ''
}) => {
  const [currentTime, setCurrentTime] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });

  const appleLogoRef = useRef<HTMLDivElement>(null);
  const menuRefs = useRef<{ [key: string]: HTMLSpanElement | null }>({});

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeString = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      setCurrentTime(timeString);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleAppleMenuClick = useCallback(() => {
    if (activeMenu === 'apple') {
      setActiveMenu(null);
    } else {
      if (appleLogoRef.current) {
        const rect = appleLogoRef.current.getBoundingClientRect();
        const parentRect = appleLogoRef.current.offsetParent?.getBoundingClientRect() || { left: 0, top: 0 };
        setDropdownPosition({ x: rect.left - parentRect.left, y: 34 });
      }
      setActiveMenu('apple');
    }
  }, [activeMenu]);

  const handleMenuItemClick = useCallback((menuLabel: string) => {
    if (activeMenu === menuLabel) {
      setActiveMenu(null);
    } else {
      const menuRef = menuRefs.current[menuLabel];
      if (menuRef) {
        const rect = menuRef.getBoundingClientRect();
        const parentRect = menuRef.offsetParent?.getBoundingClientRect() || { left: 0, top: 0 };
        setDropdownPosition({ x: rect.left - parentRect.left, y: 34 });
        setActiveMenu(menuLabel);
      }
    }
  }, [activeMenu]);

  const closeDropdown = useCallback(() => setActiveMenu(null), []);
  const handleMenuAction = useCallback((action: string) => onMenuAction?.(action), [onMenuAction]);

  return (
    <div style={{ position: 'relative' }}>
      <div
        className={`backdrop-blur-md ${className}`}
        style={{
          height: '32px',
          background: 'rgba(40, 40, 40, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
        }}
      >
        <div className="flex justify-between items-center h-full px-4">
          <div className="flex items-center space-x-4">
            <div
              ref={appleLogoRef}
              onClick={handleAppleMenuClick}
              className="cursor-pointer hover:opacity-80 transition-opacity duration-150"
            >
              <svg width="15" height="19" viewBox="0 0 110 140" fill="white" style={{ display: 'block' }}>
                <path d="M0 0 C5.58236403 2.09904125 9.60467483 0.88914551 14.97265625 -1.09375 C24.52115711 -4.439908 34.11309717 -4.54862597 43.35546875 -0.23046875 C48.12396107 2.4076135 50.86575425 5.08527779 53.41015625 9.90625 C52.35828125 10.69 51.30640625 11.47375 50.22265625 12.28125 C44.71078889 17.03285979 41.56508326 23.28635633 40.47265625 30.46875 C40.03168138 38.29605399 41.87292643 44.10920342 46.82421875 50.18359375 C49.69950343 53.3067478 52.89615914 55.56358526 56.41015625 57.90625 C53.62981681 69.36905295 47.16852412 82.51930379 37.16015625 89.40625 C32.57853571 91.90531575 28.55304343 92.53884155 23.41015625 91.90625 C21.37403354 91.28785199 19.35323208 90.61750058 17.34765625 89.90625 C8.57237805 86.84256185 3.23794872 88.20952158 -5.43359375 91.00390625 C-10.61364364 92.48483636 -14.47478385 92.64004629 -19.65234375 90.84375 C-33.68747534 81.58653555 -41.78781841 64.33028781 -45.19067383 48.33569336 C-47.46721739 34.48010623 -46.65131557 19.75938694 -38.46484375 8.03125 C-28.23499655 -4.14713952 -14.17528672 -5.71090688 0 0 Z" transform="translate(45.58984375,33.09375)" />
                <path d="M0 0 C0.57231958 7.72631433 -0.96546021 14.10973315 -5.80078125 20.30859375 C-10.93255592 25.73930675 -15.29387058 28.82351765 -22.9375 29.1875 C-23.948125 29.125625 -24.95875 29.06375 -26 29 C-26.59493662 20.81962143 -24.35167303 14.76774508 -19.375 8.25 C-14.46051828 2.89895264 -7.38077314 -0.97115436 0 0 Z" transform="translate(76,0)" />
              </svg>
            </div>

            <span className="text-white text-sm font-semibold">{appName}</span>

            <div className="flex items-center space-x-6">
              {menus.map((menu) => (
                <span
                  key={menu.label}
                  ref={(el) => { menuRefs.current[menu.label] = el; }}
                  className="text-white text-sm cursor-pointer hover:opacity-80 transition-opacity duration-150 select-none"
                  onClick={() => handleMenuItemClick(menu.label)}
                >
                  {menu.label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="cursor-pointer hover:opacity-80 transition-opacity duration-150">
              <svg width="26" height="12" viewBox="0 0 190 90" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 0 C0.82175217 -0.00511093 1.64350433 -0.01022186 2.49015808 -0.01548767 C5.19859152 -0.0293548 7.90676972 -0.02842931 10.61523438 -0.02612305 C12.50183201 -0.03001108 14.38842878 -0.03434597 16.27502441 -0.03910828 C20.22585897 -0.04656393 24.17660415 -0.04628359 28.12744141 -0.04101562 C33.18827521 -0.0352167 38.24874354 -0.05216538 43.30951691 -0.0753603 C47.20430639 -0.09009567 51.09900777 -0.09096969 54.99382019 -0.08785057 C56.85972315 -0.08836371 58.72563106 -0.09360009 60.59150696 -0.10366249 C63.20056908 -0.11600809 65.80891792 -0.10924706 68.41796875 -0.09765625 C69.18694992 -0.10529999 69.95593109 -0.11294373 70.74821472 -0.12081909 C76.48807519 -0.06449799 79.68979749 1.25547132 83.70898438 5.2746582 C85.12279298 9.05552515 84.88869294 13.09189823 84.91210938 17.07543945 C84.91780945 17.83003952 84.92350952 18.58463959 84.92938232 19.36210632 C84.93881056 20.95655932 84.94535764 22.55103161 84.94921875 24.14550781 C84.95890962 26.56846642 84.98994637 28.99057084 85.02148438 31.41333008 C85.02801682 32.96736153 85.03326635 34.52139902 85.03710938 36.07543945 C85.04945618 36.79234451 85.06180298 37.50924957 85.07452393 38.24787903 C85.05202575 43.40022518 84.24732046 46.86576899 81.70898438 51.2746582 C77.44198652 53.68062086 73.09614556 53.56449915 68.32617188 53.54931641 C67.49466614 53.55442734 66.6631604 53.55953827 65.80645752 53.56480408 C63.06555937 53.57867253 60.32491338 53.57774562 57.58398438 53.57543945 C55.6749665 53.57932741 53.76594949 53.58366229 51.85693359 53.58842468 C47.85902093 53.59588062 43.86119658 53.59559979 39.86328125 53.59033203 C34.74191497 53.58453311 29.62090983 53.60148166 24.49960327 53.6246767 C20.5584909 53.63941144 16.61746561 53.64028618 12.67633057 53.63716698 C10.788099 53.63768015 8.89986255 53.64291715 7.01165771 53.6529789 C4.37146537 53.66532324 1.73197803 53.65856418 -0.90820312 53.64697266 C-2.07570099 53.65843826 -2.07570099 53.65843826 -3.26678467 53.6701355 C-7.79019075 53.62626694 -10.58498498 52.87463498 -14.29101562 49.2746582 C-15.37523962 46.09113003 -15.37523962 46.09113003 -15.33789062 42.07543945 C-15.33219055 41.31303955 -15.32649048 40.55063965 -15.32061768 39.76536179 C-15.31118944 38.13539551 -15.30464236 36.50541298 -15.30078125 34.87543945 C-15.29109038 32.38247832 -15.32212713 29.89037641 -15.35351562 27.39755249 C-15.35832382 25.80870463 -15.36183535 24.21985221 -15.36367188 22.63099670 C-15.37601868 21.89389816 -15.38836548 21.15679962 -15.40109253 20.39743042 C-15.39312744 15.82122803 -14.94531989 12.62399542 -12.29101562 8.82543945 C-9.23437500 5.76879883 -9.23437500 5.76879883 -5.29101562 3.82543945 C-3.69137762 3.15966095 -3.69137762 3.15966095 -2.05963135 2.48052979 C-0.68897832 1.65523818 -0.68897832 1.65523818 0 0 Z" fill="#FFFFFF" transform="translate(15.291015625,18.724560546875)"/>
                <path d="M0 0 C6.61183005 2.20394335 7.27129348 2.77981088 11 8 C12.63537738 12.90613215 12.50113348 17.88031198 12 23 C10.1875 26.5625 10.1875 26.5625 8 29 C7.2884375 29.8971875 7.2884375 29.8971875 6.5625 30.8125 C5 32 5 32 0 33 C0 22.11 0 11.22 0 0 Z" fill="#FFFFFF" transform="translate(171,25)"/>
              </svg>
            </div>

            <div className="cursor-pointer hover:opacity-80 transition-opacity duration-150">
              <svg width="20" height="14" viewBox="0 0 150 110" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 0 C0.65500488 0.20898926 1.31000977 0.41797852 1.98486328 0.63330078 C14.82324128 4.91062412 25.79730909 11.812883 35.8125 20.8125 C36.57759888 21.49638794 36.57759888 21.49638794 37.3581543 22.1940918 C39.29498348 24.01298915 40.84104556 25.67845094 42.0234375 28.0703125 C41.98868831 30.93132924 40.7368247 32.00327419 38.8125 34.0625 C38.20019531 34.73410156 37.58789062 35.40570313 36.95703125 36.09765625 C33.07626002 39.86998278 33.07626002 39.86998278 31 41 C26.85231569 40.06955581 24.51783886 37.81497315 21.5625 34.875 C4.56703863 19.28329355 -16.81223148 15.07788117 -39.23388672 15.82958984 C-58.92928161 17.04295133 -76.63301992 28.19464819 -91 41 C-96.17940014 39.58743632 -99.965861 36.34834456 -103 32 C-103.39867702 28.27901445 -102.98432718 26.38320487 -100.8046875 23.3203125 C-76.41780756 -3.27241587 -33.31208663 -10.63151701 0 0 Z" fill="#FFFFFF" transform="translate(103,4)"/>
                <path d="M0 0 C1.8984375 2.05078125 1.8984375 2.05078125 2.8984375 5.05078125 C0.89685511 7.9957076 -1.65789629 10.46703226 -4.1015625 13.05078125 C-5.1534375 14.31921875 -5.1534375 14.31921875 -6.2265625 15.61328125 C-8.1015625 17.05078125 -8.1015625 17.05078125 -10.4609375 16.84375 C-13.41993192 15.95517623 -14.91300535 14.82404416 -17.2265625 12.80078125 C-27.98918153 4.03925219 -39.5915468 1.83255625 -53.1015625 3.05078125 C-61.85246663 4.93211813 -69.21440161 9.60534319 -75.8515625 15.48828125 C-78.1015625 17.05078125 -78.1015625 17.05078125 -80.44140625 16.9140625 C-83.77758701 15.83139591 -85.4436323 14.27530835 -87.9140625 11.80078125 C-88.70425781 11.0325 -89.49445313 10.26421875 -90.30859375 9.47265625 C-92.1015625 7.05078125 -92.1015625 7.05078125 -92.62109375 4.52734375 C-91.49952622 -0.81907591 -86.29726382 -3.87482782 -82.1015625 -6.94921875 C-74.21821198 -11.66652861 -66.12451308 -15.1700454 -57.1015625 -16.94921875 C-56.39128906 -17.09101562 -55.68101563 -17.2328125 -54.94921875 -17.37890625 C-34.50294745 -20.50105568 -14.99849748 -13.69736599 0 0 Z" fill="#FFFFFF" transform="translate(117.1015625,53.94921875)"/>
                <path d="M0 0 C2.55892967 1.51276457 3.9662918 2.74643145 6 5 C6.5234375 7.25390625 6.5234375 7.25390625 6 10 C4.23657597 12.43682265 2.11984755 14.43955796 -0.0625 16.5 C-0.62388672 17.05558594 -1.18527344 17.61117187 -1.76367188 18.18359375 C-5.58232446 21.89314197 -9.39060132 25.31429256 -14 28 C-19.80211565 26.44161162 -23.60213327 22.18619112 -27.875 18.1875 C-28.67164063 17.47529297 -29.46828125 16.76308594 -30.2890625 16.02929688 C-31.03671875 15.33255859 -31.784375 14.63582031 -32.5546875 13.91796875 C-33.24030762 13.28656982 -33.92592773 12.6551709 -34.63232422 12.00463867 C-36 10 -36 10 -35.83251953 7.4152832 C-34.58453344 3.79465962 -33.03776765 2.36945876 -30 0 C-18.999621 -5.30221711 -11.00576064 -5.15947378 0 0 Z" fill="#FFFFFF" transform="translate(87,77)"/>
              </svg>
            </div>

            <span className="text-white text-sm font-medium select-none ml-1 cursor-pointer hover:opacity-80 transition-opacity duration-150">
              {currentTime}
            </span>
          </div>
        </div>
      </div>

      <MenuDropdown
        isOpen={activeMenu === 'apple'}
        onClose={closeDropdown}
        items={APPLE_MENU_ITEMS}
        position={dropdownPosition}
        onAction={handleMenuAction}
      />

      {menus.map((menu) => (
        <MenuDropdown
          key={menu.label}
          isOpen={activeMenu === menu.label}
          onClose={closeDropdown}
          items={menu.items}
          position={dropdownPosition}
          onAction={handleMenuAction}
        />
      ))}
    </div>
  );
};

export default MacOSMenuBar;
