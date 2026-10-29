import java.util.Arrays;

public class TetrisCore {
    static final int W = 10, H = 20;
    static char[][] board = new char[H][W];

    static void reset() {
        for (char[] row : board) Arrays.fill(row, ' ');
    }

    static boolean collides(int[][] shape, int x, int y) {
        for (int r = 0; r < shape.length; r++) {
            for (int c = 0; c < shape[r].length; c++) {
                if (shape[r][c] == 0) continue;
                int xx = x + c, yy = y + r;
                if (xx < 0 || xx >= W || yy >= H) return true;
                if (yy >= 0 && board[yy][xx] != ' ') return true;
            }
        }
        return false;
    }

    static int clearLines() {
        int cleared = 0;
        for (int r = H - 1; r >= 0; r--) {
            boolean full = true;
            for (char cell : board[r]) if (cell == ' ') { full = false; break; }
            if (full) {
                cleared++;
                for (int y = r; y > 0; y--) board[y] = board[y - 1].clone();
                board[0] = new char[W];
                Arrays.fill(board[0], ' ');
                r++;
            }
        }
        return cleared;
    }

    public static void main(String[] args) {
        reset();
        Arrays.fill(board[H - 1], '#');
        System.out.println("Pastel Tetris core Java");
        System.out.println("Board: " + W + " x " + H);
        System.out.println("Demo cleared lines: " + clearLines());
        System.out.println("This file demonstrates collision and line-clear logic.");
    }
}
