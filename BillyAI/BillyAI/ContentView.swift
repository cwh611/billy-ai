//
//  ContentView.swift
//  BillyAI
//
//  Created by Charles Hoff on 3/26/25.
//

import SwiftUI

struct ContentView: View {
    
    @State private var loggerProcess: Process? = nil
    @State private var isRunning = false
    @State private var statusMessage = "Ready"

    var body: some View {
        ZStack {
            Color.white
            VStack(spacing: 20) {
                HStack(spacing: 0) {
                    Text("billy")
                    Text("ai")
                }
                Button(action: {
                    toggleLogger()
                }) {
                    Text(isRunning ? "Stop logger" : "Start logger")
                }
                .disabled(statusMessage.contains("Processing"))
                .cornerRadius(30)
                Text(statusMessage)
                    .font(.subheadline)
                    .foregroundColor(.gray)
            }
            .frame(width: 300, height: 200)
            
        }
    }

    func toggleLogger() {
        if isRunning {
            stopLogger()
        } else {
            startLogger()
        }
    }

    func startLogger() {
        runScript(named: "run_local_smart_logger.py")
    }

    func stopLogger() {
        runScript(named: "stop_and_process_logger.py")
    }

    func runScript(named script: String) {
        let task = Process()
        task.launchPath = "/Users/chuck/billy-ai/venv/bin/python3"
        task.arguments = ["/Users/chuck/billy-ai/\(script)"]  // 👈 Use script name here
        task.launch()

        statusMessage = script.contains("stop") ? "Processing GPT summary..." : "Logger started..."
        if script.contains("stop") {
            isRunning = false
        } else {
            isRunning = true
        }
    }

}

#Preview {
    ContentView()
}
