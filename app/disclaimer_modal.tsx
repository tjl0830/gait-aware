import React, { useEffect, useState } from 'react';
import Modal from 'react-modal';

const DisclaimerModal = () => {
    const [isOpen, setIsOpen] = useState(true);

    const closeModal = () => {
        setIsOpen(false);
    };

    useEffect(() => {
        // Logic to show modal on app startup
        setIsOpen(true);
    }, []);

    return (
        <Modal isOpen={isOpen} onRequestClose={closeModal} contentLabel="Disclaimer Modal">
            <div style={{ textAlign: 'center' }}>
                <h2>Disclaimer</h2>
                <p>
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                </p>
                <button onClick={closeModal}>Okay</button>
            </div>
        </Modal>
    );
};

export default DisclaimerModal;