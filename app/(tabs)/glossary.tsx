import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
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
    technicalDescription?: string;
    conditions: string[];
};

const GAIT_TYPES: GaitType[] = [
  {
    id: 'normal',
    title: 'Normal gait',
    description: 'A steady, balanced way of walking where both legs move smoothly in rhythm. There is even weight on both sides, proper foot lift, and coordinated arm swing.',
    technicalDescription:
      'Symmetric temporal–spatial parameters with normal stance/swing phase ratio, appropriate ground clearance during swing, heel‑strike initial contact, and coordinated contralateral arm swing. Cadence and stride length fall within age‑adjusted norms.',
    conditions: [
        'None; this is the standard walking pattern'
    ]
  },
  {
    id: 'antalgic',
    title: 'Antalgic gait',
    description: 'A way of walking used to avoid pain. The person spends less time standing on the sore or injured leg.',
    technicalDescription:
      'Protective gait with markedly shortened stance phase on the symptomatic limb and relatively prolonged swing phase to minimise weight‑bearing. Results in reduced step length, decreased cadence and temporal asymmetry; often accompanied by trunk lean away from painful joint.',
    conditions: [
      'Hip or knee arthritis',
      'Ankle sprain',
      'Foot injury',
      'Leg fracture'
    ]
  },
  {
    id: 'ataxic',
    title: 'Ataxic gait',
    description: 'An unsteady and unbalanced walk, often wide-based or staggering, as if the person is losing balance.',
    technicalDescription:
      'Broad‑based, unsteady gait due to impaired proprioception or cerebellar dysfunction. Characterised by irregular step length and timing, poor coordination, truncal instability, dysmetria and difficulty with tandem walking; Romberg positive if sensory ataxia.',
    conditions: [
      'Multiple sclerosis',
      'Cerebellar stroke',
      'Brain tumor',
      'Vitamin B12 deficiency'
    ]
  },
  {
    id: 'trendelenburg',
    title: 'Trendelenburg gait',
    description: 'The hip drops on the opposite side when walking because the muscles of the standing leg are weak.',
    technicalDescription:
      'Pelvic drop on the contralateral side during stance due to ipsilateral gluteus medius/minimus weakness or abductor dysfunction. Compensatory trunk lean toward the stance limb reduces hip abductor moment; observable as decreased single‑limb support stability.',
    conditions: [
      'Hip muscle weakness',
      'After hip surgery',
      'Polio',
      'Hip dysplasia'
    ]
  },
  {
    id: 'shuffling',
    title: 'Shuffling gait (Parkinsonian gait)',
    description: 'Short, dragging steps with little foot lift, often with a stooped posture and reduced arm swing.',
    technicalDescription:
      'Hypokinetic gait with reduced stride length, decreased step height, diminished arm swing and stooped posture. Initiation difficulty, reduced automaticity and possible festination; cadence may increase while stride length falls (sequence effect) in parkinsonian syndromes.',
    conditions: [
      'Parkinson’s disease',
      'Normal pressure hydrocephalus',
      'Drug-induced parkinsonism'
    ]
  },
  {
    id: 'hemiplegic',
    title: 'Hemiplegic gait',
    description: 'The affected leg is stiff and swings in a half-circle (circumduction) while the arm on the same side may stay flexed.',
    technicalDescription:
      'Unilateral spastic pattern with increased extensor tone and limited knee/ankle flexion; affected limb advances by circumduction or hip hiking. Ipsilateral arm often flexed with decreased reciprocal arm swing. Common after corticospinal tract lesions.',
    conditions: [
      'Stroke',
      'Multiple sclerosis',
      'Cerebral palsy',
      'Spinal cord injury'
    ]
  },
  {
    id: 'neuropathic',
    title: 'Neuropathic gait',
    description: 'The person lifts the foot higher than normal to avoid tripping because the toes do not lift properly.',
    technicalDescription:
      'Foot‑drop gait results from dorsiflexor weakness producing inadequate toe clearance and compensatory high‑steppage or hip circumduction. When dorsiflexion is weak but plantarflexor control remains, initial contact may be with a rapid uncontrolled lowering of the forefoot ("foot‑slap") rather than a controlled heel strike. Presentation may be unilateral or bilateral depending on peripheral nerve or motor pathway involvement.',
    conditions: [
      'Peroneal nerve injury',
      'Diabetic neuropathy',
      'Multiple sclerosis',
      'Charcot–Marie–Tooth disease'
    ]
  },
  {
    id: 'waddling',
    title: 'Waddling gait',
    description: 'A side-to-side walking motion, like a duck. The body swings when moving forward.',
    technicalDescription:
      'Gait with exaggerated lateral trunk sway and widened base due to proximal muscle weakness (hip girdle). Pelvic instability during stance, reduced hip abduction control and compensatory foot placement produce the characteristic waddling pattern.',
    conditions: [
      'Weak hip or thigh muscles',
      'Muscular dystrophy',
      'Congenital hip dislocation',
      'Obesity'
    ]
  },
  {
    id: 'festinating',
    title: 'Festinating gait',
    description: 'Short, quick steps with the body leaning forward, as if chasing one’s own balance.',
    technicalDescription:
      'Progressive small‑stepped gait with forward flexed posture and increasing cadence; step length shortens while rhythm accelerates (festination). Often seen in advanced parkinsonian disorders with impaired postural reflexes.',
    conditions: [
      'Advanced Parkinson’s disease',
      'Progressive supranuclear palsy',
      'Multiple system atrophy'
    ]
  },
  {
    id: 'diplegic',
    title: 'Diplegic gait (Scissors gait)',
    description: 'The legs cross or hit each other while walking, making the steps look like scissor blades.',
    technicalDescription:
      'Spastic diplegic pattern with bilateral lower‑limb adductor spasticity causing scissoring of the legs during swing. Typically reduced hip abduction, increased adductor tone and pelvic instability; common in cerebral palsy and bilateral upper motor neuron lesions.',
    conditions: [
      'Cerebral palsy',
      'Spastic paraplegia',
      'Bilateral stroke'
    ]
  }
];


export default function Tab() {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [showTechnical, setShowTechnical] = useState<Record<string, boolean>>({});
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

        // when collapsing, also hide technical view
        if (expanded[id]) {
            setShowTechnical(prev => ({ ...prev, [id]: false }));
        }
    };

    const toggleTechnical = (id: string) => {
        setShowTechnical(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <View style={styles.container}>
            <Text style={styles.heading}>Glossary</Text>

            <FlatList
              data={GAIT_TYPES}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 20 }}
              renderItem={({ item }) => {
                const isOpen = !!expanded[item.id];
                const isTech = !!showTechnical[item.id];
                const anim = animsRef.current[item.id] ?? (animsRef.current[item.id] = new Animated.Value(0));
                return (
                  <Animated.View
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
                      style={[styles.header, isOpen ? styles.headerOpen : null]}
                    >
                      <Text style={[styles.title, isOpen ? styles.titleOpen : null]}>{item.title}</Text>
                      <Text style={[styles.chev, isOpen ? styles.chevOpen : null]}>{isOpen ? '−' : '+'}</Text>
                    </TouchableOpacity>

                    {isOpen && (
                      <View style={styles.content}>
                        <Animated.View
                          style={{
                            transform: [{
                              translateY: anim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-20, 0],
                              })
                            }],
                            opacity: anim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 1]
                            })
                          }}
                        >
                          <Text style={styles.desc}>{isTech ? (item.technicalDescription ?? item.description) : item.description}</Text>

                          <TouchableOpacity onPress={() => toggleTechnical(item.id)} style={styles.technicalToggle}>
                            <Text style={styles.technicalToggleText}>{isTech ? 'Switch to simple' : 'Switch to technical'}</Text>
                          </TouchableOpacity>

                          <Text style={styles.subheading}>Common underlying conditions:</Text>
                          {item.conditions.map((condition, index) => (
                            <Text key={index} style={styles.condition}>• {condition}</Text>
                          ))}
                        </Animated.View>
                      </View>
                    )}
                  </Animated.View>
                );
              }}
            />
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
    headerOpen: {
        backgroundColor: '#dceaff',
        borderBottomWidth: 1,
        borderBottomColor: '#c2d9ff',
    },
    title: {
        fontSize: 20, // Larger title
        fontWeight: '600',
        color: '#000', // Maximum contrast
        flex: 1,
        paddingRight: 8,
    },
    titleOpen: {
        color: '#0b62d6',
    },
    chev: {
        fontSize: 24, // Larger chevron
        fontWeight: '600',
        color: '#000',
    },
    chevOpen: {
        color: '#0b62d6',
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
    technicalToggle: {
        marginTop: 10,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#eef6ff',
    },
    technicalToggleText: {
        color: '#0b62d6',
        fontWeight: '600',
        fontSize: 14,
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
    disclaimerContainer: {
        marginHorizontal: 20,
        marginBottom: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ececec',
    },
    disclaimerText: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
        fontStyle: 'italic',
    },
});