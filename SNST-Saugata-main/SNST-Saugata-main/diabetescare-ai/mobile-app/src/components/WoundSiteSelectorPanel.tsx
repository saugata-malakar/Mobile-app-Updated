import React, {useState} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {WOUND_ZONES, type WoundZoneOption} from './woundSiteTypes';

export default function WoundSiteSelectorPanel({
  selected,
  onSelect,
  subtitle,
}: {
  selected: WoundZoneOption | null;
  onSelect: (z: WoundZoneOption) => void;
  subtitle?: string;
}) {
  const [plantar, setPlantar] = useState(true);

  return (
    <View>
      <Text style={styles.sub}>
        {subtitle ??
          (plantar
            ? 'Plantar (sole) view — tap a zone. Use the toggle for dorsal view.'
            : 'Dorsal view — same tap zones approximate the top of the foot.')}
      </Text>

      <TouchableOpacity style={styles.toggle} onPress={() => setPlantar(p => !p)}>
        <Text style={styles.toggleText}>
          {plantar ? 'Flip to dorsal view' : 'Flip to plantar view'}
        </Text>
      </TouchableOpacity>

      <View style={styles.feetRow}>
        <FootColumn
          title="Left"
          zones={WOUND_ZONES.filter(z => z.side === 'L')}
          selected={selected}
          onPick={onSelect}
        />
        <FootColumn
          title="Right"
          zones={WOUND_ZONES.filter(z => z.side === 'R')}
          selected={selected}
          onPick={onSelect}
        />
      </View>

      {selected ? (
        <View style={styles.confirm}>
          <Text style={styles.confirmText}>{selected.label} — is this correct?</Text>
        </View>
      ) : null}
    </View>
  );
}

function FootColumn({
  title,
  zones,
  selected,
  onPick,
}: {
  title: string;
  zones: WoundZoneOption[];
  selected: WoundZoneOption | null;
  onPick: (z: WoundZoneOption) => void;
}) {
  return (
    <View style={{flex: 1}}>
      <Text style={styles.footTitle}>{title}</Text>
      <View style={styles.footOutline}>
        {zones.map(z => {
          const on = selected?.id === z.id;
          return (
            <TouchableOpacity
              key={z.id}
              style={[styles.zone, on && styles.zoneOn]}
              onPress={() => onPick(z)}>
              <Text style={[styles.zoneText, on && styles.zoneTextOn]} numberOfLines={2}>
                {z.label.replace(`${title === 'Left' ? 'Left' : 'Right'} `, '')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sub: {marginTop: 8, color: 'rgba(248,250,252,0.72)', lineHeight: 20},
  toggle: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.45)',
    backgroundColor: 'rgba(37,99,235,0.15)',
  },
  toggleText: {color: '#93C5FD', fontWeight: '800'},
  feetRow: {flexDirection: 'row', gap: 10, marginTop: 16},
  footTitle: {color: '#E2E8F0', fontWeight: '900', marginBottom: 8},
  footOutline: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    padding: 8,
    gap: 6,
    backgroundColor: 'rgba(15,23,42,0.5)',
  },
  zone: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    backgroundColor: 'rgba(30,41,59,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  zoneOn: {borderColor: '#38BDF8', backgroundColor: 'rgba(56,189,248,0.18)'},
  zoneText: {color: 'rgba(248,250,252,0.85)', fontSize: 11, fontWeight: '700'},
  zoneTextOn: {color: '#F8FAFC'},
  confirm: {
    marginTop: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.35)',
  },
  confirmText: {color: '#DCFCE7', fontWeight: '800'},
});
