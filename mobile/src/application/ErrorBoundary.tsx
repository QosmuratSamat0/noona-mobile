import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../shared/theme/colors';
import { styles } from '../shared/ui/styles';

type State = {
  error?: Error;
};

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={[styles.center, { padding: 24, backgroundColor: colors.bg }]}>
        <Text style={styles.hello}>App crashed</Text>
        <Text style={[styles.subText, { marginTop: 12, textAlign: 'center' }]}>{this.state.error.message}</Text>
        <Pressable style={[styles.primaryButton, { alignSelf: 'stretch', marginTop: 24 }]} onPress={() => this.setState({ error: undefined })}>
          <Text style={styles.primaryButtonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}
