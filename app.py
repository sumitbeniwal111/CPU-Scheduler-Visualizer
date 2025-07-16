import math
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# --- CPU Scheduling Algorithms ---

def calculate_fcfs(processes_data):
    """
    Calculates FCFS (First-Come, First-Served) scheduling metrics.
    Processes are sorted by arrival time.
    """
    # Create a deep copy to avoid modifying the original list
    processes = sorted([p.copy() for p in processes_data], key=lambda x: x['arrivalTime'])

    current_time = 0
    results = []
    
    for i, p in enumerate(processes):
        # If the CPU is idle until this process arrives, advance current_time
        start_time = max(current_time, p['arrivalTime'])
        
        completion_time = start_time + p['burstTime']
        turnaround_time = completion_time - p['arrivalTime']
        waiting_time = turnaround_time - p['burstTime']
        response_time = start_time - p['arrivalTime'] # For FCFS, response time is start time - arrival time

        results.append({
            'id': p['id'],
            'arrivalTime': p['arrivalTime'],
            'burstTime': p['burstTime'],
            'completionTime': completion_time,
            'turnaroundTime': turnaround_time,
            'waitingTime': waiting_time,
            'responseTime': response_time,
            'startTime': start_time, # Added for Gantt chart
            'endTime': completion_time # Added for Gantt chart
        })
        current_time = completion_time
    
    # Sort results by original process ID for consistent display
    results.sort(key=lambda x: int(x['id'][1:]))

    # Calculate averages
    total_wt = sum(p['waitingTime'] for p in results)
    total_tat = sum(p['turnaroundTime'] for p in results)
    total_ct = sum(p['completionTime'] for p in results)

    num_processes = len(results)
    avg_wt = total_wt / num_processes if num_processes > 0 else 0
    avg_tat = total_tat / num_processes if num_processes > 0 else 0
    avg_ct = total_ct / num_processes if num_processes > 0 else 0

    return results, avg_wt, avg_tat, avg_ct

def calculate_sjf_non_preemptive(processes_data):
    """
    Calculates SJF (Shortest Job First) non-preemptive scheduling metrics.
    Processes are sorted by arrival time initially, then by burst time from ready queue.
    """
    processes = sorted([p.copy() for p in processes_data], key=lambda x: x['arrivalTime'])
    n = len(processes)
    
    completed_processes = []
    current_time = 0
    
    # Keep track of which processes have arrived but not yet executed
    ready_queue = []
    
    # Keep track of processes that are still to arrive
    remaining_processes = processes[:] 

    # Loop until all processes are completed
    while len(completed_processes) < n:
        # Add processes that have arrived by current_time to the ready queue
        # and remove them from remaining_processes
        arrived_now = [p for p in remaining_processes if p['arrivalTime'] <= current_time]
        for p in arrived_now:
            ready_queue.append(p)
            remaining_processes.remove(p)
        
        # If ready queue is empty, and there are still processes to arrive,
        # advance current_time to the next arrival time
        if not ready_queue and remaining_processes:
            current_time = min(p['arrivalTime'] for p in remaining_processes)
            # Re-check for newly arrived processes after advancing time
            arrived_now = [p for p in remaining_processes if p['arrivalTime'] <= current_time]
            for p in arrived_now:
                ready_queue.append(p)
                remaining_processes.remove(p)


        # Sort ready queue by burst time (SJF)
        ready_queue.sort(key=lambda x: x['burstTime'])

        if ready_queue:
            # Pick the process with the shortest burst time from the ready queue
            executing_process = ready_queue.pop(0)

            start_time = current_time
            completion_time = start_time + executing_process['burstTime']
            turnaround_time = completion_time - executing_process['arrivalTime']
            waiting_time = turnaround_time - executing_process['burstTime']
            response_time = start_time - executing_process['arrivalTime']

            completed_processes.append({
                'id': executing_process['id'],
                'arrivalTime': executing_process['arrivalTime'],
                'burstTime': executing_process['burstTime'],
                'completionTime': completion_time,
                'turnaroundTime': turnaround_time,
                'waitingTime': waiting_time,
                'responseTime': response_time,
                'startTime': start_time,
                'endTime': completion_time
            })
            current_time = completion_time
        elif remaining_processes and not ready_queue:
            # If ready queue is empty but there are still processes that haven't arrived,
            # advance time to the next arrival to avoid infinite loop
            current_time = min(p['arrivalTime'] for p in remaining_processes)
        else:
            # No more processes to execute or arrive
            break

    # Sort results by original process ID for consistent display
    completed_processes.sort(key=lambda x: int(x['id'][1:]))

    # Calculate averages
    total_wt = sum(p['waitingTime'] for p in completed_processes)
    total_tat = sum(p['turnaroundTime'] for p in completed_processes)
    total_ct = sum(p['completionTime'] for p in completed_processes)

    num_processes = len(completed_processes)
    avg_wt = total_wt / num_processes if num_processes > 0 else 0
    avg_tat = total_tat / num_processes if num_processes > 0 else 0
    avg_ct = total_ct / num_processes if num_processes > 0 else 0

    return completed_processes, avg_wt, avg_tat, avg_ct


# --- Flask Routes ---

@app.route('/')
def index():
    """Renders the main HTML page."""
    return render_template('index.html')

@app.route('/calculate', methods=['POST'])
def calculate():
    """
    Receives process data from the frontend, performs scheduling calculations,
    and returns the results as JSON.
    """
    data = request.get_json()
    processes_data = data['processes']
    algorithm = data['algorithm']

    if not processes_data:
        return jsonify({
            'error': 'No processes provided.',
            'results': [],
            'avg_wt': 0,
            'avg_tat': 0,
            'avg_ct': 0,
            'gantt_chart': []
        })

    try:
        if algorithm == 'fcfs':
            results, avg_wt, avg_tat, avg_ct = calculate_fcfs(processes_data)
        elif algorithm == 'sjf':
            results, avg_wt, avg_tat, avg_ct = calculate_sjf_non_preemptive(processes_data)
        else:
            return jsonify({'error': 'Invalid algorithm selected.'}), 400

        # Prepare Gantt chart data
        gantt_chart_data = []
        for p in results:
            gantt_chart_data.append({
                'id': p['id'],
                'start': p['startTime'],
                'end': p['endTime'],
                'color': p.get('color', '#4CAF50') # Use a default color if not provided
            })
        
        # Sort Gantt chart data by start time for correct visualization order
        gantt_chart_data.sort(key=lambda x: x['start'])

        return jsonify({
            'results': results,
            'avg_wt': round(avg_wt, 2),
            'avg_tat': round(avg_tat, 2),
            'avg_ct': round(avg_ct, 2),
            'gantt_chart': gantt_chart_data
        })
    except Exception as e:
        # Log the error for debugging
        print(f"Error during calculation: {e}")
        return jsonify({'error': f'An error occurred during calculation: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True)
