import React, { useEffect, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';

type GaitType = {
    id: string;
    title: string;
    description: string;
};

const GAIT_TYPES: GaitType[] = [
    {
        id: 'antalgic',
        title: 'Antalgic gait',
        description: 'A gait adopted to avoid pain on weight bearing structures, typically characterised by a shortened stance phase on the affected side.',
    },
    {
        id: 'ataxic',
        title: 'Ataxic gait',
        description: 'Unsteady, staggering gait with wide base of support often caused by cerebellar or sensory dysfunction.',
    },
    {
        id: 'trendelenburg',
        title: 'Trendelenburg gait',
        description: 'Drop of the pelvis on the contralateral side during single limb stance due to weak hip abductors (gluteus medius/minimus).',
    },
    {
        id: 'shuffling',
        title: 'Shuffling gait',
        description: 'Small, shuffling steps often seen in Parkinsonian syndromes with reduced arm swing and stooped posture.',
    },
    // add more as needed
];

export default function Tab() {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
            UIManager.setLayoutAnimationEnabledExperimental(true);
        }
    }, []);

    const toggle = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <View style={styles.container}>
            <Text style={styles.heading}>Glossary</Text>
            <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 24 }}>
                {GAIT_TYPES.map(item => {
                    const isOpen = !!expanded[item.id];
                    return (
                        <View key={item.id} style={styles.item}>
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
                                </View>
                            )}
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 16,
        backgroundColor: '#fff',
    },
    heading: {
        fontSize: 22,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 8,
    },
    list: {
        paddingHorizontal: 16,
    },
    item: {
        marginBottom: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        overflow: 'hidden',
        backgroundColor: '#fafafa',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
    },
    title: {
        fontSize: 16,
        fontWeight: '500',
    },
    chev: {
        fontSize: 18,
        fontWeight: '600',
    },
    content: {
        paddingHorizontal: 12,
        paddingBottom: 12,
    },
    desc: {
        fontSize: 14,
        color: '#333',
        lineHeight: 20,
    },
});
