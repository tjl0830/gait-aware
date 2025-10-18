import React, { useEffect, useRef, useState } from 'react';
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
    // per-item animated values so only the selected glossary item animates
    const animsRef = useRef<Record<string, Animated.Value>>({});

    useEffect(() => {
        // create an Animated.Value for each gait type on mount
        GAIT_TYPES.forEach(item => {
            if (!animsRef.current[item.id]) {
                animsRef.current[item.id] = new Animated.Value(0);
            }
        });
    }, []);

    const toggle = (id: string) => {
        const isOpen = !!expanded[id];
        const toValue = isOpen ? 0 : 1;

        // ensure Animated.Value exists for all items
        GAIT_TYPES.forEach(item => {
            if (!animsRef.current[item.id]) {
                animsRef.current[item.id] = new Animated.Value(0);
            }
        });

        if (toValue === 1) {
            // opening: animate the selected item to 1, close others to 0
            const animations = GAIT_TYPES.map(item => {
                const anim = animsRef.current[item.id];
                return Animated.timing(anim, {
                    toValue: item.id === id ? 1 : 0,
                    duration: item.id === id ? 300 : 200,
                    useNativeDriver: true,
                });
            });
            Animated.parallel(animations).start();
        } else {
            // closing: only animate the selected item to 0
            const anim = animsRef.current[id];
            Animated.timing(anim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }).start();
        }

        // keep expanded state; when opening, ensure others are false so only one is selected
        setExpanded(prev => {
            const next = { ...prev, [id]: !prev[id] };
            if (!prev[id]) { // we are opening id -> collapse others
                Object.keys(next).forEach(k => { if (k !== id) next[k] = false; });
            }
            return next;
        });
    };

    return (
        <View style={styles.container}>
            <Text style={styles.heading}>Glossary</Text>
            <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 24 }}>
                {GAIT_TYPES.map(item => {
                    const isOpen = !!expanded[item.id];
                    // use the per-item Animated.Value (fallback to a new value if not present)
                    const anim = animsRef.current[item.id] ?? (animsRef.current[item.id] = new Animated.Value(0));
                    return (
                        <Animated.View
                            key={item.id}
                            style={[
                                styles.item,
                                {
                                    transform: [{
                                        scale: anim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [1, 1.01], // subtle scale for the selected item
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
                                    <Animated.View
                                        style={{
                                            transform: [{
                                                translateY: anim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [-20, 0], // Changed from [20, 0] to [-20, 0]
                                                })
                                            }],
                                            opacity: anim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0, 1]
                                            })
                                        }}
                                    >
                                        <Text style={styles.desc}>{item.description}</Text>
                                        <Text style={styles.subheading}>Common underlying conditions:</Text>
                                        {item.conditions.map((condition, index) => (
                                            <Text key={index} style={styles.condition}>• {condition}</Text>
                                        ))}
                                    </Animated.View>
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
        paddingTop: 32, // Increased from 24 to 32
    },
    heading: {
        fontSize: 28,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 24, // Increased from 16 to 24
        color: '#000',
    },
    list: {
        paddingHorizontal: 20,
        paddingTop: 8, // Added padding top to list
    },
    item: {
        marginBottom: 16, // More space between items
        borderRadius: 12, // Slightly larger radius
        borderWidth: 1.5, 
        borderColor: '#a1a1a1ff',
        overflow: 'hidden',
        backgroundColor: '#ffffff', // Pure white background
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16, // More padding
        paddingHorizontal: 16,
        backgroundColor: '#f7f7f7ff', // Slight contrast for header
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