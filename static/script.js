document.addEventListener('DOMContentLoaded', () => {
    const processTableBody = document.getElementById('processTableBody');
    const addRowBtn = document.getElementById('addRowBtn');
    const deleteRowBtn = document.getElementById('deleteRowBtn');
    const calculateBtn = document.getElementById('calculateBtn');
    const resultsTableBody = document.getElementById('resultsTableBody');
    const avgWtSpan = document.getElementById('avgWt');
    const avgTatSpan = document.getElementById('avgTat');
    const avgCtSpan = document.getElementById('avgCt');
    const resultsSection = document.getElementById('resultsSection');
    const ganttChartSection = document.getElementById('ganttChartSection');
    const ganttChartCanvas = document.getElementById('ganttChartCanvas');
    const ganttChartLabels = document.getElementById('ganttChartLabels');
    const ctx = ganttChartCanvas.getContext('2d');

    let processIdCounter = 1; // To keep track of process IDs

    // Function to generate a random pastel color
    function getRandomPastelColor() {
        const hue = Math.floor(Math.random() * 360);
        const saturation = Math.floor(Math.random() * 25) + 75; // 75-100% saturation
        const lightness = Math.floor(Math.random() * 10) + 75; // 75-85% lightness
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    // Function to add a new row to the process input table
    function addRow() {
        processIdCounter++;
        const newRow = document.createElement('tr');
        newRow.innerHTML = `
            <td>P${processIdCounter}</td>
            <td><input type="number" value="0" min="0" class="arrival-time"></td>
            <td><input type="number" value="5" min="1" class="burst-time"></td>
        `;
        processTableBody.appendChild(newRow);
    }

    // Function to delete the last row from the process input table
    function deleteRow() {
        if (processTableBody.children.length > 1) { // Ensure at least one row remains
            processTableBody.removeChild(processTableBody.lastChild);
            processIdCounter--;
        }
    }

    // Function to draw the Gantt Chart
    function drawGanttChart(ganttData, totalTime) {
        // Clear previous chart and labels
        ctx.clearRect(0, 0, ganttChartCanvas.width, ganttChartCanvas.height);
        ganttChartLabels.innerHTML = '';

        // Set canvas dimensions dynamically based on content width
        // A minimum width is set, and it scales with total time
        const scaleFactor = 30; // Pixels per unit of time
        const minCanvasWidth = 600;
        ganttChartCanvas.width = Math.max(minCanvasWidth, totalTime * scaleFactor + 50); // Add some padding
        ganttChartCanvas.height = 100; // Fixed height for simplicity

        const barHeight = 40;
        const yOffset = 30; // Space for process IDs
        const textYOffset = yOffset + barHeight / 2 + 5; // Center text vertically in bar

        // Draw each process bar
        ganttData.forEach(process => {
            const startX = process.start * scaleFactor;
            const width = (process.end - process.start) * scaleFactor;
            const color = process.color || getRandomPastelColor(); // Use assigned color or generate one

            ctx.fillStyle = color;
            ctx.fillRect(startX, yOffset, width, barHeight);

            ctx.strokeStyle = '#333';
            ctx.strokeRect(startX, yOffset, width, barHeight);

            ctx.fillStyle = '#000';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(process.id, startX + width / 2, textYOffset);
        });

        // Draw time scale (horizontal axis)
        ctx.fillStyle = '#333';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';

        // Draw time markers and labels
        for (let time = 0; time <= totalTime; time++) {
            const x = time * scaleFactor;
            ctx.beginPath();
            ctx.moveTo(x, yOffset);
            ctx.lineTo(x, yOffset + barHeight + 10); // Extend tick mark below bar
            ctx.stroke();
            ctx.fillText(time.toString(), x, yOffset + barHeight + 25);
        }
    }

    // Event listener for Add Row button
    addRowBtn.addEventListener('click', addRow);

    // Event listener for Delete Row button
    deleteRowBtn.addEventListener('click', deleteRow);

    // Event listener for Calculate button
    calculateBtn.addEventListener('click', async () => {
        const processes = [];
        const rows = processTableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const processId = row.querySelector('td:first-child').textContent;
            const arrivalTime = parseInt(row.querySelector('.arrival-time').value);
            const burstTime = parseInt(row.querySelector('.burst-time').value);

            if (isNaN(arrivalTime) || isNaN(burstTime) || burstTime <= 0) {
                // Using a simple alert for now as per instructions, consider custom modal for better UX
                alert('Please enter valid positive numbers for Arrival Time and Burst Time (Burst Time must be > 0).');
                return; // Stop processing if invalid input
            }

            processes.push({
                id: processId,
                arrivalTime: arrivalTime,
                burstTime: burstTime,
                color: getRandomPastelColor() // Assign a color for Gantt chart
            });
        });

        if (processes.length === 0) {
            alert('Please add at least one process.');
            return;
        }

        const selectedAlgorithm = document.querySelector('input[name="algorithm"]:checked').value;

        try {
            const response = await fetch('/calculate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ processes: processes, algorithm: selectedAlgorithm }),
            });

            const data = await response.json();

            if (response.ok) {
                // Clear previous results
                resultsTableBody.innerHTML = '';

                // Populate results table
                data.results.forEach(p => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${p.id}</td>
                        <td>${p.arrivalTime}</td>
                        <td>${p.burstTime}</td>
                        <td>${p.responseTime}</td>
                        <td>${p.completionTime}</td>
                        <td>${p.turnaroundTime}</td>
                        <td>${p.waitingTime}</td>
                    `;
                    resultsTableBody.appendChild(row);
                });

                // Update averages
                avgWtSpan.textContent = data.avg_wt.toFixed(2);
                avgTatSpan.textContent = data.avg_tat.toFixed(2);
                avgCtSpan.textContent = data.avg_ct.toFixed(2);

                // Show results section
                resultsSection.style.display = 'block';

                // Draw Gantt Chart
                ganttChartSection.style.display = 'block';
                const totalTime = Math.max(...data.gantt_chart.map(p => p.end));
                drawGanttChart(data.gantt_chart, totalTime);

            } else {
                alert(`Error: ${data.error || 'Something went wrong.'}`);
                console.error('Server error:', data.error);
            }
        } catch (error) {
            alert('An error occurred while communicating with the server.');
            console.error('Fetch error:', error);
        }
    });

    // Initial setup: Ensure at least one row exists on load
    if (processTableBody.children.length === 0) {
        addRow(); // Add the first row if none exists
        processIdCounter = 1; // Reset counter for initial state
        processTableBody.querySelector('.arrival-time').value = 0;
        processTableBody.querySelector('.burst-time').value = 5;
    }
});
