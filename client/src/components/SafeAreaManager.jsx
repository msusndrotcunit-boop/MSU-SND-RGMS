import React from 'react';

export const SafeAreaContext = React.createContext({
    insets: { top: 0, right: 0, bottom: 0, left: 0 }
});

export const SafeAreaProvider = ({ children }) => {
    const insets = {
        top: typeof window !== 'undefined' ? parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0', 10) || 0 : 0,
        right: typeof window !== 'undefined' ? parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sar') || '0', 10) || 0 : 0,
        bottom: typeof window !== 'undefined' ? parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab') || '0', 10) || 0 : 0,
        left: typeof window !== 'undefined' ? parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sal') || '0', 10) || 0 : 0
    };

    return (
        <SafeAreaContext.Provider value={{ insets }}>
            {children}
        </SafeAreaContext.Provider>
    );
};

const SafeAreaManager = ({ children, className = '' }) => {
    const { insets } = React.useContext(SafeAreaContext);

    const style = {
        paddingTop: insets.top,
        paddingRight: insets.right,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left
    };

    return (
        <div className={className} style={style}>
            {children}
        </div>
    );
};

export const FixedElement = ({ children, position, respectSafeArea = false, className = '' }) => {
    const { insets } = React.useContext(SafeAreaContext);

    const style = {};
    if (respectSafeArea) {
        if (position === 'top' || position === 'left') {
            style.paddingTop = insets.top;
            style.paddingLeft = insets.left;
        }
        if (position === 'bottom' || position === 'right') {
            style.paddingBottom = insets.bottom;
            style.paddingRight = insets.right;
        }
    }

    return (
        <div className={className} style={style}>
            {children}
        </div>
    );
};

export default SafeAreaManager;

