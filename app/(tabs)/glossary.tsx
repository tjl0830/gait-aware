import React, { useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// Update the type definition
type GaitType = {
    id: string;
    title: string;
    description: string;
    conditions: string[]; // Add this field
};

const GAIT_TYPES: GaitType[] = [
    {
        id: 'antalgic',
        title: 'Antalgic gait',
        description: 'A gait adopted to avoid pain on weight bearing structures, typically characterised by a shortened stance phase on the affected side.',
        conditions: [
            'Hip arthritis',
            'Knee osteoarthritis',
            'Ankle sprains',
            'Foot injuries',
            'Lower extremity fractures'
        ]
    },
    {
        id: 'ataxic',
        title: 'Ataxic gait',
        description: 'Unsteady, staggering gait with wide base of support often caused by cerebellar or sensory dysfunction.',
        conditions: [
            'Multiple sclerosis',
            'Cerebellar stroke',
            'Brain tumors',
            'Alcoholic cerebellar degeneration',
            'Vitamin B12 deficiency'
        ]
    },
    {
        id: 'trendelenburg',
        title: 'Trendelenburg gait',
        description: 'Drop of the pelvis on the contralateral side during single limb stance due to weak hip abductors (gluteus medius/minimus).',
        conditions: [
            'Hip dysplasia',
            'Post hip surgery',
            'Polio',
            'Superior gluteal nerve injury',
            'Muscular dystrophy'
        ]
    },
    {
        id: 'shuffling',
        title: 'Shuffling gait',
        description: 'Small, shuffling steps often seen in Parkinsonian syndromes with reduced arm swing and stooped posture.',
        conditions: [
            'Parkinson\'s disease',
            'Multiple system atrophy',
            'Normal pressure hydrocephalus',
            'Progressive supranuclear palsy',
            'Drug-induced parkinsonism'
        ]
    },
];

export default function Tab() {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [animation] = useState(() => new Animated.Value(0));

    const toggle = (id: string) => {
        Animated.timing(animation, {
            toValue: expanded[id] ? 0 : 1,
            duration: 300,
            useNativeDriver: true,
        }).start();
        
        setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <View style={styles.container}>
            <Text style={styles.heading}>Glossary</Text>
            <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 24 }}>
                {GAIT_TYPES.map(item => {
                    const isOpen = !!expanded[item.id];
                    return (
                        <Animated.View 
                            key={item.id} 
                            style={[
                                styles.item,
                                {
                                    transform: [{
                                        scale: animation.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [1, 1.01] // Changed from 1.02 to 1.01 for subtler effect
                                        })
                                    }]
                                }
                            ]}
                        >
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => toggle(item.id)}
                                style={styles.header}
                            >
                                <Text style={styles.title}>{item.title}</Text>
                                <Text style={styles.chev}>{isOpen ? '−' : '+'}</Text>
                            </TouchableOpacity>

                            {isOpen && (
                                <View style={styles.content}>
                                    <Text style={styles.desc}>{item.description}</Text>
                                    <Text style={styles.subheading}>Common underlying conditions:</Text>
                                    {item.conditions.map((condition, index) => (
                                        <Text key={index} style={styles.condition}>• {condition}</Text>
                                    ))}
                                </View>
                            )}
                        </Animated.View>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 24, // Increased padding
        backgroundColor: '#fff',
    },
    heading: {
        fontSize: 28, // Larger heading
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 16,
        color: '#000', // Ensuring maximum contrast
    },
    list: {
        paddingHorizontal: 20, // More padding
    },
    item: {
        marginBottom: 16, // More space between items
        borderRadius: 12, // Slightly larger radius
        borderWidth: 1.5, 
        borderColor: '#d0d0d0',
        overflow: 'hidden',
        backgroundColor: '#ffffff', // Pure white background
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16, // More padding
        paddingHorizontal: 16,
        backgroundColor: '#f8f8f8', // Slight contrast for header
    },
    title: {
        fontSize: 20, // Larger title
        fontWeight: '600',
        color: '#000', // Maximum contrast
        flex: 1,
        paddingRight: 8,
    },
    chev: {
        fontSize: 24, // Larger chevron
        fontWeight: '600',
        color: '#000',
    },
    content: {
        paddingHorizontal: 16,
        paddingVertical: 16, // Added vertical padding
    },
    desc: {
        fontSize: 18, // Larger description text
        color: '#000',
        lineHeight: 26, // Increased line height
    },
    subheading: {
        fontSize: 19, // Larger subheading
        fontWeight: '600',
        marginTop: 16,
        marginBottom: 8,
        color: '#000',
    },
    condition: {
        fontSize: 18, // Larger condition text
        color: '#000',
        lineHeight: 26,
        marginLeft: 12,
        marginBottom: 4, // Space between conditions
    },
});
